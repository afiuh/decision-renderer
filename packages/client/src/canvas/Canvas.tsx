import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveCollisions } from './collision'
import { pushAway } from './liveCollision'
import { ReactFlow, Background, Controls, useNodesState, type Node, type Edge, type ReactFlowInstance } from '@xyflow/react'
import { radialLayout } from './radialLayout'
import { NodeCard } from './NodeCard'
import { RoutedEdge } from './RoutedEdge'
import { useEdgeRouting } from 'reactflow-edge-routing'
import { ContentNode } from './ContentNode'
import type { TreeEdge, TreeNode } from '../../../shared/types'

const nodeTypes = { card: NodeCard, content: ContentNode }
const edgeTypes = { routed: RoutedEdge }
const NODE_W = 180
const NODE_H = 56

/** 树 → 扁平列表（只收可见节点：根 + 展开的子孙）。 */
function visibleNodes(tree: TreeNode, expanded: ReadonlySet<string>): TreeNode[] {
  const result: TreeNode[] = []
  const walk = (node: TreeNode): void => {
    result.push(node)
    if (expanded.has(node.id)) {
      for (const child of node.children) walk(child)
    }
  }
  for (const child of tree.children) if (child.children.length > 0) walk(child)
  return result
}

export function Canvas({ tree, edges, onOpen, workspace }: {
  tree: TreeNode | null
  edges: readonly TreeEdge[]
  onOpen: (id: string) => void
  workspace: string
}) {
  const flowRef = useRef<ReactFlowInstance | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [seededPath, setSeededPath] = useState<string | null>(null)
  useEffect(() => {
    if (tree === null || seededPath === tree.path) return
    const first = tree.children.find(child => child.children.length > 0) ?? tree.children[0]
    setExpanded(new Set(first === undefined ? [] : [first.id]))
    setSeededPath(tree.path)
  }, [tree, seededPath])

  const toggle = useCallback((id: string) => {
    console.log('[toggle]', id)
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  // 切工作区时：读 layout + fitView（拖拽/树更新不重置缩放）
  useEffect(() => {
    void fetch(`/api/layout?workspace=${encodeURIComponent(workspace)}`)
      .then(response => response.json() as Promise<Record<string, { x: number; y: number }>>)
      .then(saved => {
        if (Object.keys(saved).length === 0) return
        setNodes(current => current.map(item => saved[item.id] === undefined ? item : { ...item, position: saved[item.id] }))
      })
      .catch(() => {})
    const timer = setTimeout(() => flowRef.current?.fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.1 }), 300)
    return () => clearTimeout(timer)
  }, [workspace, setNodes])
  const openContent = useCallback(async (id: string) => {
    const response = await fetch(`/api/node/${encodeURIComponent(id)}?workspace=${encodeURIComponent(workspace)}`)
    const node = await response.json() as { id: string; title: string; path: string; markdown: string }
    setNodes(prev => {
      const filtered = prev.filter(item => item.id !== `content-${id}`)
      const offset = filtered.filter(item => item.type === 'content').length
      // 初始位置：视口右侧空白（避开左侧节点树），多个内容节点依次偏移
      const screen = flowRef.current?.screenToFlowPosition({ x: window.innerWidth - 620, y: window.innerHeight / 2 }) ?? { x: 200, y: 80 }
      const withContent = [...filtered, {
        id: `content-${id}`,
        type: 'content',
        position: { x: screen.x + offset * 40, y: screen.y + offset * 40 },
        width: 520,
        height: 420,
        data: { node, workspace, onClose: () => setNodes(list => list.filter(item => item.id !== `content-${id}`)) },
        style: { width: 520, height: 420 },
      }]
      // 新增内容节点后推挤所有重叠（含节点）
      return resolveCollisions(withContent, { maxIterations: 50, overlapThreshold: 0.5, margin: 8 })
    })
  }, [setNodes])

  const { computedNodes, flowEdges } = useMemo(() => {
    if (tree === null) return { computedNodes: [] as Node[], flowEdges: [] as Edge[] }
    const visible = visibleNodes(tree, expanded)
    const positions = radialLayout(tree, expanded)
    const built: Node[] = visible.map(node => ({
      id: node.id,
      type: 'card',
      position: (() => { const center = positions.get(node.id) ?? { x: 0, y: 0 }; return { x: center.x - 90, y: center.y - 28 } })(),
      data: { title: node.title, status: node.status, dirty: node.dirty, hasChildren: node.children.length > 0, expanded: expanded.has(node.id), onToggle: () => toggle(node.id) },
    }))
    const ids = new Set(visible.map(node => node.id))
    const flowEdges: Edge[] = edges
      .filter(edge => edge.from !== '__root__' && ids.has(edge.from) && ids.has(edge.to))
      .map(edge => ({ id: `${edge.from}->${edge.to}`, source: edge.from, target: edge.to, type: 'routed', style: { stroke: '#94a3b8', strokeWidth: 1.5 } }))
    return { computedNodes: built, flowEdges }
  }, [tree, edges, expanded, toggle])

  // 树/展开变化时重置节点位置
  useEffect(() => { setNodes(computedNodes) }, [computedNodes, setNodes])

  const contentEdges = useMemo(() => nodes.filter(item => item.type === 'content').map(item => ({
    id: `content-edge-${item.id}`,
    source: item.id,
    target: item.id.replace(/^content-/, ''),
    type: 'default',
    style: { strokeDasharray: '4 4', stroke: '#94a3b8', strokeWidth: 1 },
  })), [nodes])

  const { updateRoutingOnNodesChange, resetRouting } = useEdgeRouting(nodes, flowEdges, {
    connectorType: 'orthogonal',
    edgeRounding: 12,
    edgeToEdgeSpacing: 4,
    edgeToNodeSpacing: 8,
    autoBestSideConnection: false,
  })

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes)
    updateRoutingOnNodesChange(changes)
  }, [onNodesChange, updateRoutingOnNodesChange])

  // 展开/折叠后重新 fitView（子节点可能超出视口）
  useEffect(() => {
    const timer = setTimeout(() => flowRef.current?.fitView({ padding: 0.15, maxZoom: 1, minZoom: 0.1 }), 200)
    return () => clearTimeout(timer)
  }, [expanded])

  // 拖拽中：实时推挤（只推重叠的，O(n)）
  const onNodeDrag = useCallback((_: unknown, moved: Node) => {
    setNodes(current => {
      const others = current.filter(item => item.id !== moved.id)
      const pushed = pushAway(moved, others)
      const byId = new Map(pushed.map(item => [item.id, item]))
      return current.map(item => item.id === moved.id ? moved : (byId.get(item.id) ?? item))
    })
  }, [setNodes])

  // 拖拽结束：官方 resolveCollisions（多轮迭代，沿小轴推开）
  // 右键：重命名 / 删除
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type !== 'card') return
    event.preventDefault()
    const title = window.prompt('新标题（留空=删除该节点）', String(node.data.title ?? ''))
    if (title === null) return
    if (title.trim() === '') {
      if (!window.confirm(`删除「${String(node.data.title)}」及其子节点？`)) return
      void fetch(`/api/node/${encodeURIComponent(node.id)}?workspace=${encodeURIComponent(workspace)}`, { method: 'DELETE' })
      return
    }
    if (title.trim() === String(node.data.title)) return
    void fetch(`/api/node/${encodeURIComponent(node.id)}?workspace=${encodeURIComponent(workspace)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    })
  }, [workspace])

  const onNodeDragStop = useCallback(() => {
    setNodes(current => {
      const resolved = resolveCollisions(current, { maxIterations: 50, overlapThreshold: 0.5, margin: 8 })
      const layout: Record<string, { x: number; y: number }> = {}
      for (const item of resolved) layout[item.id] = item.position
      void fetch(`/api/layout?workspace=${encodeURIComponent(workspace)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(layout),
      })
      return resolved
    })
  }, [setNodes, workspace])

  return (
    <ReactFlow
      onInit={instance => { flowRef.current = instance }}

      nodes={nodes}
      onNodesChange={handleNodesChange}
      onNodeDrag={onNodeDrag}
      onNodeContextMenu={onNodeContextMenu}
      onNodeDragStop={onNodeDragStop}
      edges={[...flowEdges, ...contentEdges]}
      edgeTypes={edgeTypes}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => { if (node.type === 'card') { onOpen(node.id); void openContent(node.id) } }}
      fitView
      maxZoom={1}
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
