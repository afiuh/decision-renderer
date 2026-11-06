import { useMemo } from 'react'
import { ReactFlow, Background, Controls, type Node } from '@xyflow/react'
import type { TreeEdge, TreeNode } from '../../../shared/types'
import { useLayout } from '../layout/useLayout'
import { useDrag } from '../drag/useDrag'
import { useContent } from '../content/useContent'
import { NodeCard } from './NodeCard'
import { ContentNode } from './ContentNode'
import { RoutedEdge } from './RoutedEdge'

const nodeTypes = { card: NodeCard, content: ContentNode }
const edgeTypes = { routed: RoutedEdge }

/** 画布：拼装（布局 + 拖动 + 内容 + 边）。 */
export function Canvas({ tree, edges, workspace }: {
  tree: TreeNode | null
  edges: readonly TreeEdge[]
  workspace: string
}) {
  const { flowRef, nodes, setNodes, onNodesChange, layout } = useLayout(tree, workspace)
  const drag = useDrag(
    layout?.parents ?? new Map<string, string>(),
    layout?.radii ?? new Map<string, number>(),
    layout?.descendants ?? new Map<string, string[]>(),
    setNodes,
  )
  const { openContent } = useContent(workspace, setNodes)

  const flowEdges = useMemo(() => {
    if (layout === null) return []
    return edges
      .filter(edge => edge.from !== '__root__' && layout.positions.has(edge.from) && layout.positions.has(edge.to))
      .map(edge => ({ id: `${edge.from}->${edge.to}`, source: edge.from, target: edge.to, type: 'routed', style: { stroke: '#94a3b8', strokeWidth: 1.5 } }))
  }, [edges, layout])

  const onNodeContextMenu = (event: React.MouseEvent, node: Node): void => {
    if (node.type !== 'card') return
    event.preventDefault()
    const title = window.prompt('新标题（留空=删除）', String(node.data.title ?? ''))
    if (title === null) return
    if (title.trim() === '') {
      if (window.confirm(`删除「${String(node.data.title)}」及其子节点？`)) {
        void fetch(`/api/node/${encodeURIComponent(node.id)}?workspace=${encodeURIComponent(workspace)}`, { method: 'DELETE' })
      }
      return
    }
    if (title.trim() !== String(node.data.title)) {
      void fetch(`/api/node/${encodeURIComponent(node.id)}?workspace=${encodeURIComponent(workspace)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })
    }
  }

  return (
    <ReactFlow
      onInit={instance => { flowRef.current = instance }}
      nodes={nodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => { if (node.type === 'card') void openContent(node.id) }}
      onNodeContextMenu={onNodeContextMenu}
      onNodeDragStart={drag.onNodeDragStart}
      onNodeDrag={drag.onNodeDrag}
      onNodeDragStop={drag.onNodeDragStop}
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
