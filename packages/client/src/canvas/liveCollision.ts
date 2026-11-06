/** 拖拽时实时推挤：只推与拖拽节点重叠的（O(n)，沿小轴推对方）。 */
import type { Node } from '@xyflow/react'

function boxOf(node: Node): { x: number; y: number; w: number; h: number } {
  return {
    x: node.position.x,
    y: node.position.y,
    w: node.width ?? node.measured?.width ?? 180,
    h: node.height ?? node.measured?.height ?? 56,
  }
}

/** 返回被推开的节点（不修改入参）。 */
export function pushAway(moved: Node, others: readonly Node[], gap = 8): Node[] {
  const m = boxOf(moved)
  return others.map(other => {
    const o = boxOf(other)
    const dx = (m.x + m.w / 2) - (o.x + o.w / 2)
    const dy = (m.y + m.h / 2) - (o.y + o.h / 2)
    const px = (m.w + o.w) / 2 + gap - Math.abs(dx)
    const py = (m.h + o.h) / 2 + gap - Math.abs(dy)
    if (px <= 0 || py <= 0) return other
    if (px < py) return { ...other, position: { x: other.position.x - Math.sign(dx || 1) * px, y: other.position.y } }
    return { ...other, position: { x: other.position.x, y: other.position.y - Math.sign(dy || 1) * py } }
  })
}
