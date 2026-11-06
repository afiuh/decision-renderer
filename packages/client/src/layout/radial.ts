/** 圆形扩散布局（纯函数）：全圆 + 半径延长（circleRadius 递归）。 */
import type { TreeNode } from '../../../shared/types'

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
  parents: Map<string, string>
  radii: Map<string, number>
  descendants: Map<string, string[]>
}

const NODE = 140
const GAP = 40

function circleRadius(node: TreeNode, expanded: ReadonlySet<string>): number {
  if (!expanded.has(node.id) || node.children.length === 0) return NODE
  return Math.max(...node.children.map(child => circleRadius(child, expanded))) + NODE + GAP
}

export function radialLayout(tree: TreeNode, expanded: ReadonlySet<string>): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>()
  const parents = new Map<string, string>()
  const radii = new Map<string, number>()
  const descendants = new Map<string, string[]>()

  const place = (node: TreeNode, cx: number, cy: number, parentId: string | null): void => {
    positions.set(node.id, { x: cx, y: cy })
    if (parentId !== null) parents.set(node.id, parentId)
    if (node.children.length > 0) {
      const collect = (n: TreeNode): string[] => expanded.has(n.id) ? [n.id, ...n.children.flatMap(collect)] : [n.id]
      descendants.set(node.id, node.children.flatMap(collect))
    }
    if (!expanded.has(node.id) || node.children.length === 0) return
    const span = (2 * Math.PI) / node.children.length
    node.children.forEach((child, index) => {
      const theta = -Math.PI / 2 + index * span
      // 每个子节点单独算：连线长度 = 子节点的占地面积（circleRadius）+ 节点 + 间隙
      const cr = circleRadius(child, expanded)
      const r = Math.max(NODE + GAP, cr + NODE + GAP)
      radii.set(child.id, r)
      place(child, cx + r * Math.cos(theta), cy + r * Math.sin(theta), node.id)
    })
  }

  const roots = tree.children.filter(root => root.children.length > 0)
  if (roots.length === 1) {
    place(roots[0], 0, 0, null)
  } else if (roots.length > 1) {
    const span = (2 * Math.PI) / roots.length
    roots.forEach((root, index) => {
      const theta = -Math.PI / 2 + index * span
      const R = Math.max(NODE + GAP, circleRadius(root, expanded) + NODE + GAP)
      radii.set(root.id, R)
      place(root, R * Math.cos(theta), R * Math.sin(theta), null)
    })
  }
  return { positions, parents, radii, descendants }
}
