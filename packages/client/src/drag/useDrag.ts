import { useCallback, useRef } from 'react'
import type { Node } from '@xyflow/react'

/** 拖动：沿圆周旋转（保持半径）+ 子节点跟随（delta）。 */
export function useDrag(parents: Map<string, string>, radii: Map<string, number>, descendants: Map<string, string[]>, setNodes: React.Dispatch<React.SetStateAction<Node[]>>) {
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const onNodeDragStart = useCallback((_: unknown, node: Node) => { dragStart.current = { x: node.position.x, y: node.position.y } }, [])

  const onNodeDrag = useCallback((_: unknown, moved: Node) => {
    const parentId = parents.get(moved.id)
    const radius = radii.get(moved.id)
    if (parentId === undefined || radius === undefined) return
    setNodes(prev => {
      const parent = prev.find(item => item.id === parentId)
      if (parent === undefined) return prev
      const angle = Math.atan2(moved.position.y - parent.position.y, moved.position.x - parent.position.x)
      const position = { x: parent.position.x + radius * Math.cos(angle), y: parent.position.y + radius * Math.sin(angle) }
      const old = dragStart.current ?? position
      const delta = { x: position.x - old.x, y: position.y - old.y }
      const kids = new Set(descendants.get(moved.id) ?? [])
      return prev.map(item => {
        if (item.id === moved.id) return { ...item, position }
        if (kids.has(item.id)) return { ...item, position: { x: item.position.x + delta.x, y: item.position.y + delta.y } }
        return item
      })
    })
  }, [parents, radii, descendants, setNodes])

  const onNodeDragStop = useCallback(() => { dragStart.current = null }, [])
  return { onNodeDragStart, onNodeDrag, onNodeDragStop }
}
