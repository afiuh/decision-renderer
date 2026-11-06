/** 圆形扩散布局：每个节点 360° 展开子节点；父节点到上一级的距离 = 子节点圆半径 + 节点尺寸（延长，防重叠）。 */
import type { TreeNode } from '../../../shared/types'

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
  parents: Map<string, string>
  radii: Map<string, number>
}

const NODE = 140         // 节点尺寸（卡片宽）
const GAP = 40           // 节点之间的间隙

/** 节点的"圆半径"：它的子节点圆半径 + 节点尺寸（递归，延长）。 */
function circleRadius(node: TreeNode, expanded: ReadonlySet<string>): number {
  if (!expanded.has(node.id) || node.children.length === 0) return NODE
  const maxChild = Math.max(...node.children.map(child => circleRadius(child, expanded)))
  return maxChild + NODE + GAP
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

    // 半径 = 子节点的最大圆半径 + 节点尺寸 + 间隙（延长，确保子节点的圆不覆盖祖先）
    const r = Math.max(NODE + GAP, Math.max(...children.map(child => circleRadius(child, expanded))) + NODE + GAP)

    let angle = -Math.PI / 2
    for (const child of children) {
      const span = (2 * Math.PI) / children.length
      const theta = angle + span / 2
      angle += span
      radii.set(child.id, r)
      place(child, cx + r * Math.cos(theta), cy + r * Math.sin(theta), node.id)
    }
  }

  // 根在中心
  const roots = tree.children.filter(root => root.children.length > 0)
  if (roots.length === 1) {
    place(roots[0], 0, 0, null)
  } else if (roots.length > 1) {
    const R = Math.max(NODE + GAP, Math.max(...roots.map(root => circleRadius(root, expanded))) + NODE + GAP)
    let angle = -Math.PI / 2
    for (const root of roots) {
      const span = (2 * Math.PI) / roots.length
      const theta = angle + span / 2
      angle += span
      radii.set(root.id, R)
      place(root, R * Math.cos(theta), R * Math.sin(theta), null)
    }
  }
  return { positions, parents, radii }
}
