import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveCollisions } from './collision'
import { pushAway } from './liveCollision'
import { ReactFlow, Background, Controls, useNodesState, type Node, type Edge, type ReactFlowInstance } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { NodeCard } from './NodeCard'
import { ContentNode } from './ContentNode'
import type { TreeEdge, TreeNode } from '../../../shared/types'

const nodeTypes = { card: NodeCard, content: ContentNode }
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
  for (const child of tree.children) walk(child)
  return result
}

/** dagre 布局（只排可见节点）。 */
function layout(nodes: TreeNode[], edges: readonly TreeEdge[]): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'LR', nodesep: 20, ranksep: 80, marginx: 24, marginy: 24 })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const node of nodes) graph.setNode(node.id, { width: NODE_W, height: NODE_H })
  const ids = new Set(nodes.map(node => node.id))
  for (const edge of edges) if (edge.from !== '__root__' && ids.has(edge.from) && ids.has(edge.to)) graph.setEdge(edge.from, edge.to)
  dagre.layout(graph)
  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const point = graph.node(node.id)
    positions.set(node.id, { x: point.x - NODE_W / 2, y: point.y - NODE_H / 2 })
  }
  return positions
}

export function Canvas({ tree, edges, onOpen }: {
  tree: TreeNode | null
  edges: readonly TreeEdge[]
  onOpen: (id: string) => void
}) {
  const flowRef = useRef<ReactFlowInstance | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (tree === null || seeded) return
    setExpanded(new Set(tree.children.map(child => child.id)))
    setSeeded(true)
  }, [tree, seeded])

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
  useEffect(() => {
    if (tree === null) return
    const timer = setTimeout(() => flowRef.current?.fitView({ padding: 0.2, minZoom: 0.1 }), 150)
    return () => clearTimeout(timer)
  }, [tree])
  const openContent = useCallback(async (id: string) => {
    const response = await fetch(`/api/node/${encodeURIComponent(id)}`)
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
        data: { node, onClose: () => setNodes(list => list.filter(item => item.id !== `content-${id}`)) },
        style: { width: 520, height: 420 },
      }]
      // 新增内容节点后推挤所有重叠（含节点）
      return resolveCollisions(withContent, { maxIterations: 50, overlapThreshold: 0.5, margin: 8 })
    })
  }, [setNodes])

  const { computedNodes, flowEdges } = useMemo(() => {
    if (tree === null) return { nodes: [] as Node[], flowEdges: [] as Edge[] }
    const visible = visibleNodes(tree, expanded)
    const positions = layout(visible, edges)
    const built: Node[] = visible.map(node => ({
      id: node.id,
      type: 'card',
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: { title: node.title, status: node.status, dirty: node.dirty, hasChildren: node.children.length > 0, expanded: expanded.has(node.id), onToggle: () => toggle(node.id) },
    }))
    const ids = new Set(visible.map(node => node.id))
    const flowEdges: Edge[] = edges
      .filter(edge => edge.from !== '__root__' && ids.has(edge.from) && ids.has(edge.to))
      .map(edge => ({ id: `${edge.from}->${edge.to}`, source: edge.from, target: edge.to, type: 'smoothstep' }))
    return { computedNodes: built, flowEdges }
  }, [tree, edges, expanded, toggle])

  // 树/展开变化时重置节点位置
  useEffect(() => { setNodes(computedNodes) }, [computedNodes, setNodes])

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
  const onNodeDragStop = useCallback(() => {
    setNodes(current => resolveCollisions(current, { maxIterations: 50, overlapThreshold: 0.5, margin: 8 }))
  }, [setNodes])

  return (
    <ReactFlow
      onInit={instance => { flowRef.current = instance }}

      nodes={nodes}
      onNodesChange={onNodesChange}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => { if (node.type === 'card') { onOpen(node.id); void openContent(node.id) } }}
      fitView
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
