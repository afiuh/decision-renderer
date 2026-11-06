import { useEffect, useMemo, useRef } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge, type ReactFlowInstance } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { NodeCard } from './NodeCard'
import type { TreeEdge, TreeNode } from '../../../shared/types'

const nodeTypes = { card: NodeCard }
const NODE_W = 180
const NODE_H = 56

/** 树 → 扁平列表。 */
function flatten(tree: TreeNode): TreeNode[] {
  const result: TreeNode[] = []
  const walk = (node: TreeNode): void => {
    result.push(node)
    for (const child of node.children) walk(child)
  }
  for (const child of tree.children) walk(child)
  return result
}

/** dagre 自动布局（紧凑树形，不重叠）。 */
function layout(tree: TreeNode, edges: readonly TreeEdge[]): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'TB', nodesep: 24, ranksep: 60, marginx: 24, marginy: 24 })
  graph.setDefaultEdgeLabel(() => ({}))
  const flat = flatten(tree)
  for (const node of flat) graph.setNode(node.id, { width: NODE_W, height: NODE_H })
  for (const edge of edges) if (edge.from !== '__root__') graph.setEdge(edge.from, edge.to)
  dagre.layout(graph)
  const positions = new Map<string, { x: number; y: number }>()
  for (const node of flat) {
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
  const { nodes, flowEdges } = useMemo(() => {
    if (tree === null) return { nodes: [] as Node[], flowEdges: [] as Edge[] }
    const positions = layout(tree, edges)
    const nodes: Node[] = flatten(tree).map(node => ({
      id: node.id,
      type: 'card',
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: { title: node.title, status: node.status },
    }))
    const flowEdges: Edge[] = edges
      .filter(edge => edge.from !== '__root__')
      .map(edge => ({
        id: `${edge.from}->${edge.to}`,
        source: edge.from,
        target: edge.to,
        type: 'smoothstep',
      }))
    return { nodes, flowEdges }
  }, [tree, edges])

  useEffect(() => {
    if (nodes.length === 0) return
    const timer = setTimeout(() => flowRef.current?.fitView({ padding: 0.05, minZoom: 0.05 }), 100)
    return () => clearTimeout(timer)
  }, [nodes])

  return (
    <ReactFlow
      onInit={instance => { flowRef.current = instance }}
      nodes={nodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onOpen(node.id)}
      fitView
      minZoom={0.05}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
