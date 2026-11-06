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
    const r = Math.max(NODE + GAP, Math.max(...node.children.map(child => circleRadius(child, expanded))) + NODE + GAP)
    let angle = -Math.PI / 2
    for (const child of node.children) {
      const span = (2 * Math.PI) / node.children.length
      const theta = angle + span / 2
      angle += span
      radii.set(child.id, r)
      place(child, cx + r * Math.cos(theta), cy + r * Math.sin(theta), node.id)
    }
  }

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
  return { positions, parents, radii, descendants }
}
