/** 圆形扩散布局（参考词块树：每个节点展开后子节点围绕它全圆分布，半径按占位延长）。 */
import type { TreeNode } from '../../../shared/types'

/** 子树占位（节点数；折叠的节点算 1）。 */
function occupancy(node: TreeNode, expanded: ReadonlySet<string>): number {
  if (!expanded.has(node.id)) return 1
  return 1 + node.children.reduce((sum, child) => sum + occupancy(child, expanded), 0)
}

export function radialLayout(tree: TreeNode, expanded: ReadonlySet<string>): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  const place = (node: TreeNode, cx: number, cy: number): void => {
    positions.set(node.id, { x: cx, y: cy })
    if (!expanded.has(node.id)) return
    const children = node.children
    if (children.length === 0) return

    // 半径 = 占位 × 间距 / 2π（周长 = 占位总和）→ 子树大，半径线自然延长
    const totalOcc = children.reduce((sum, child) => sum + occupancy(child, expanded), 0)
    const r = Math.max(200, (totalOcc * 90) / (2 * Math.PI))

    // 子节点全圆分布（角度按占位比例）
    let angle = -Math.PI / 2
    for (const child of children) {
      const span = (2 * Math.PI) * occupancy(child, expanded) / totalOcc
      const theta = angle + span / 2
      angle += span
      place(child, cx + r * Math.cos(theta), cy + r * Math.sin(theta))
    }
  }

  // 根（有子节点的）在中心；多个根时围绕中心
  const roots = tree.children.filter(root => root.children.length > 0)
  if (roots.length === 1) {
    place(roots[0], 0, 0)
  } else if (roots.length > 1) {
    const totalOcc = roots.reduce((sum, root) => sum + occupancy(root, expanded), 0)
    const R = Math.max(240, (totalOcc * 90) / (2 * Math.PI))
    let angle = -Math.PI / 2
    for (const root of roots) {
      const span = (2 * Math.PI) * occupancy(root, expanded) / totalOcc
      const theta = angle + span / 2
      angle += span
      place(root, R * Math.cos(theta), R * Math.sin(theta))
    }
  }
  return positions
}
