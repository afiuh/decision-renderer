import { useEffect } from 'react'
import { useNodesState, type Node } from '@xyflow/react'
import type { TreeNode } from '../../../shared/types'
import type { LayoutResult } from './radial'

const NODE_W = 140
const NODE_H = 40

export function useNodes(tree: TreeNode | null, layout: LayoutResult | null, expanded: ReadonlySet<string>, toggle: (id: string) => void) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])

  useEffect(() => {
    if (layout === null || tree === null) return
    const walk = (node: TreeNode): TreeNode[] => {
      const result = [node]
      if (expanded.has(node.id)) for (const child of node.children) result.push(...walk(child))
      return result
    }
    const flat: TreeNode[] = []
    for (const child of tree.children) if (child.children.length > 0) flat.push(...walk(child))
    setNodes(prev => {
      const existing = new Map(prev.map(item => [item.id, item]))
      const treeNodes = flat.map(node => existing.get(node.id) ?? {
        id: node.id,
        type: 'card',
        position: (() => {
          const center = layout.positions.get(node.id) ?? { x: 0, y: 0 }
          return { x: center.x - NODE_W / 2, y: center.y - NODE_H / 2 }
        })(),
        data: { title: node.title, status: node.status, dirty: node.dirty, hasChildren: node.children.length > 0, expanded: expanded.has(node.id), onToggle: () => toggle(node.id) },
      })
      return [...treeNodes, ...prev.filter(item => item.type === 'content')]
    })
  }, [layout, tree, expanded, toggle, setNodes])

  return { nodes, setNodes, onNodesChange }
}
