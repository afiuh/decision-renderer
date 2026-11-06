import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNodesState, type Node, type ReactFlowInstance } from '@xyflow/react'
import type { TreeNode } from '../../../shared/types'
import { radialLayout } from './radial'

export function useLayout(tree: TreeNode | null, workspace: string) {
  const flowRef = useRef<ReactFlowInstance | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [seededPath, setSeededPath] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])

  useEffect(() => {
    if (tree === null || seededPath === tree.path) return
    const first = tree.children.find(child => child.children.length > 0) ?? tree.children[0]
    setExpanded(new Set(first === undefined ? [] : [first.id]))
    setSeededPath(tree.path)
  }, [tree, seededPath])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const layout = useMemo(() => (tree === null ? null : radialLayout(tree, expanded)), [tree, expanded])

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
        position: (() => { const center = layout.positions.get(node.id) ?? { x: 0, y: 0 }; return { x: center.x - 70, y: center.y - 20 } })(),
        data: { title: node.title, status: node.status, dirty: node.dirty, hasChildren: node.children.length > 0, expanded: expanded.has(node.id), onToggle: () => toggle(node.id) },
      })
      return [...treeNodes, ...prev.filter(item => item.type === 'content')]
    })
  }, [layout, tree, expanded, toggle, setNodes])

  useEffect(() => {
    const timer = setTimeout(() => flowRef.current?.fitView({ padding: 0.3, maxZoom: 1, minZoom: 0.1 }), 300)
    return () => clearTimeout(timer)
  }, [expanded, workspace])

  return { flowRef, expanded, toggle, nodes, setNodes, onNodesChange, layout }
}
