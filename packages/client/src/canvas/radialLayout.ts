/** 圆形扩散布局（扇形：子节点在父节点外侧，不与其他根重叠）。 */
import type { TreeNode } from '../../../shared/types'

export function radialLayout(tree: TreeNode, expanded: ReadonlySet<string>): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  const place = (node: TreeNode, cx: number, cy: number, baseAngle: number, spread: number): void => {
    positions.set(node.id, { x: cx, y: cy })
    if (!expanded.has(node.id)) return
    const children = node.children
    if (children.length === 0) return
    const r = Math.max(300, children.length * 105)
    const span = spread / children.length
    let angle = baseAngle - spread / 2
    for (const child of children) {
      const theta = angle + span / 2
      angle += span
      place(child, cx + r * Math.cos(theta), cy + r * Math.sin(theta), theta, span * 0.9)
    }
  }

  // 3 个根在圆周上（半径 320），每个根的子节点在自己外侧的扇形里
  const roots = tree.children.filter(root => root.children.length > 0)
  const R = Math.max(200, roots.length * 70)
  const span = (2 * Math.PI) / Math.max(1, roots.length)
  let angle = -Math.PI / 2
  for (const root of roots) {
    const theta = angle + span / 2
    angle += span
    place(root, R * Math.cos(theta), R * Math.sin(theta), theta, span * 0.85)
  }
  return positions
}
