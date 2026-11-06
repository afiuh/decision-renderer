/** 圆形扩散布局（词块树方式：每个节点展开后，子节点围绕它全圆 360°，半径按占位递增）。 */
import type { TreeNode } from '../../../shared/types'

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
  parents: Map<string, string>
  radii: Map<string, number>
}

function occupancy(node: TreeNode, expanded: ReadonlySet<string>): number {
  if (!expanded.has(node.id)) return 1
  return 1 + node.children.reduce((sum, child) => sum + occupancy(child, expanded), 0)
}

export function radialLayout(tree: TreeNode, expanded: ReadonlySet<string>): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>()
  const parents = new Map<string, string>()
  const radii = new Map<string, number>()

  const place = (node: TreeNode, cx: number, cy: number, parentId: string | null): void => {
    positions.set(node.id, { x: cx, y: cy })
    if (parentId !== null) parents.set(node.id, parentId)
    if (!expanded.has(node.id)) return
    const children = node.children
    if (children.length === 0) return

    // 半径 = 占位 × 间距 / 2π（子节点越多/越深，圆越大；子节点在父节点的圆外）
    const totalOcc = children.reduce((sum, child) => sum + occupancy(child, expanded), 0)
    const r = Math.max(150, (totalOcc * 200) / (2 * Math.PI))

    // 全圆（360°），角度按占位比例
    let angle = -Math.PI / 2
    for (const child of children) {
      const span = (2 * Math.PI) * occupancy(child, expanded) / totalOcc
      const theta = angle + span / 2
      angle += span
      radii.set(child.id, r)
      place(child, cx + r * Math.cos(theta), cy + r * Math.sin(theta), node.id)
    }
  }

  // 根在中心（有子节点的根）
  const roots = tree.children.filter(root => root.children.length > 0)
  if (roots.length === 1) {
    place(roots[0], 0, 0, null)
  } else if (roots.length > 1) {
    const totalOcc = roots.reduce((sum, root) => sum + occupancy(root, expanded), 0)
    const R = Math.max(240, (totalOcc * 200) / (2 * Math.PI))
    let angle = -Math.PI / 2
    for (const root of roots) {
      const span = (2 * Math.PI) * occupancy(root, expanded) / totalOcc
      const theta = angle + span / 2
      angle += span
      radii.set(root.id, R)
      place(root, R * Math.cos(theta), R * Math.sin(theta), null)
    }
  }
  return { positions, parents, radii }
}
