/** 圆形扩散布局（参考词块树：占位 occupancy 决定半径和角度）。 */
import type { TreeNode } from '../../../shared/types'

/** 子树占位（节点数；折叠的节点算 1）。 */
function occupancy(node: TreeNode, expanded: ReadonlySet<string>): number {
  if (!expanded.has(node.id)) return 1
  return 1 + node.children.reduce((sum, child) => sum + occupancy(child, expanded), 0)
}

export function radialLayout(tree: TreeNode, expanded: ReadonlySet<string>): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  const place = (node: TreeNode, cx: number, cy: number, baseAngle: number, spread: number): void => {
    positions.set(node.id, { x: cx, y: cy })
    if (!expanded.has(node.id)) return
    const children = node.children
    if (children.length === 0) return

    // 半径 = 总占位 × 间距 / 2π（周长 = 占位总和），子节点越多/越深，半径越大
    const totalOcc = children.reduce((sum, child) => sum + occupancy(child, expanded), 0)
    const r = Math.max(220, (totalOcc * 60) / (2 * Math.PI))

    let angle = baseAngle - spread / 2
    for (const child of children) {
      const span = spread * occupancy(child, expanded) / totalOcc   // 角度按占位比例
      const theta = angle + span / 2
      angle += span
      place(child, cx + r * Math.cos(theta), cy + r * Math.sin(theta), theta, span * 0.9)
    }
  }

  // 根：有子节点的根（核心战略），占位决定半径
  const roots = tree.children.filter(root => root.children.length > 0)
  const totalOcc = roots.reduce((sum, root) => sum + occupancy(root, expanded), 0)
  const R = Math.max(240, (totalOcc * 70) / (2 * Math.PI))
  let angle = -Math.PI / 2
  for (const root of roots) {
    const span = (2 * Math.PI) * occupancy(root, expanded) / totalOcc
    const theta = angle + span / 2
    angle += span
    place(root, R * Math.cos(theta), R * Math.sin(theta), theta, span * 0.85)
  }
  return positions
}
