/** AABB 碰撞检测 + 推挤。 */
export interface Box { id: string; x: number; y: number; w: number; h: number }

export function overlaps(a: Box, b: Box, gap = 8): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
}

/** 把 `other` 推到 `moved` 的右侧（不重叠）。 */
export function pushRight(moved: Box, other: Box, gap = 8): { x: number; y: number } {
  return { x: moved.x + moved.w + gap, y: other.y }
}
