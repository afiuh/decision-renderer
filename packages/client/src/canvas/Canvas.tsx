import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge, type ReactFlowInstance } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { NodeCard } from './NodeCard'
import type { TreeEdge, TreeNode } from '../../../shared/types'

const nodeTypes = { card: NodeCard }
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

  const { nodes, flowEdges } = useMemo(() => {
    if (tree === null) return { nodes: [] as Node[], flowEdges: [] as Edge[] }
    const visible = visibleNodes(tree, expanded)
    const positions = layout(visible, edges)
    const nodes: Node[] = visible.map(node => ({
      id: node.id,
      type: 'card',
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: { title: node.title, status: node.status, hasChildren: node.children.length > 0, expanded: expanded.has(node.id), onToggle: () => toggle(node.id) },
    }))
    const ids = new Set(visible.map(node => node.id))
    const flowEdges: Edge[] = edges
      .filter(edge => edge.from !== '__root__' && ids.has(edge.from) && ids.has(edge.to))
      .map(edge => ({ id: `${edge.from}->${edge.to}`, source: edge.from, target: edge.to, type: 'smoothstep' }))
    return { nodes, flowEdges }
  }, [tree, edges, expanded, toggle])

  return (
    <ReactFlow
      onInit={instance => { flowRef.current = instance }}

      nodes={nodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onOpen(node.id)}
      fitView
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
