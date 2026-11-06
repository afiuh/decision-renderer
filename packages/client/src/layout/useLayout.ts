import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TreeNode } from '../../../shared/types'
import { radialLayout, type LayoutResult } from './radial'

export function useLayout(tree: TreeNode | null): {
  expanded: ReadonlySet<string>
  toggle: (id: string) => void
  layout: LayoutResult | null
} {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [seededPath, setSeededPath] = useState<string | null>(null)

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
  return { expanded, toggle, layout }
}
