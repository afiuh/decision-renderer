import type { TreeNode } from "@dr/shared";

export const GAP = 24;
export const DEFAULT_SIZE = { width: 120, height: 36 };
export const CONTENT_SIZE = { width: 560, height: 440 };
export const CONTENT_PREFIX = "content:";

export interface LayoutInput {
  roots: TreeNode[];
  expanded: Set<string>;
  sizes: Map<string, { width: number; height: number }>;
  /** 用户拖过的角度（弧度），拖动后持久保留 */
  dragged: Map<string, number>;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  parents: Map<string, string | null>;
  radii: Map<string, number>;
  angles: Map<string, number>;
  circles: Map<string, number>;
  arcs: Map<string, number>;
}

/** 框的半对角线：中心到框上最远点（碰撞椭圆的保守半径） */
function halfDiagonal(size: { width: number; height: number }) {
  return Math.hypot(size.width, size.height) / 2;
}

/** 框在距离 r 处实际占的角度区间（切线角，角点贴圆） */
export function spanAt(r: number, halfDiag: number) {
  if (r <= halfDiag) return Math.PI;
  return 2 * Math.atan(halfDiag / Math.sqrt(Math.max(1e-6, r * r - halfDiag * halfDiag)));
}

/** 内切椭圆：a = w/2，b = h/2（框包住椭圆） */
export function ellipseOf(size: { width: number; height: number }) {
  return { a: size.width / 2, b: size.height / 2 };
}

/** 两个轴对齐椭圆是否重叠（用平均半径做圆碰撞近似） */
export function ellipsesOverlap(
  p1: { x: number; y: number }, s1: { width: number; height: number },
  p2: { x: number; y: number }, s2: { width: number; height: number },
): boolean {
  const e1 = ellipseOf(s1), e2 = ellipseOf(s2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const ra = (e1.a + e1.b) / 2;
  const rb = (e2.a + e2.b) / 2;
  return Math.hypot(dx, dy) < ra + rb;
}

/**
 * 最基础布局：一个节点展开，N 个子节点均匀分布。
 *
 * 半径 r 要保证：
 *   1. 父椭圆与子椭圆相切：r ≥ 父半对角线 + 子半对角线
 *   2. 相邻子椭圆相切（弦长）：2r·sin(θ/2) ≥ 2·子半对角线
 *      → r ≥ 子半对角线 / sin(θ/2)
 *
 * 取两者最大值。子节点按 θ = 2π/N 均匀分布。
 */
export function radialLayout({ roots, expanded, sizes, dragged }: LayoutInput): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  const parents = new Map<string, string | null>();
  const radii = new Map<string, number>();
  const angles = new Map<string, number>();
  const circles = new Map<string, number>();
  const arcs = new Map<string, number>();

  const sizeOf = (id: string) => sizes.get(id) ?? DEFAULT_SIZE;
  const radiusOf = (id: string) => halfDiagonal(sizeOf(id));
  const isOpen = (n: TreeNode) => expanded.has(n.id) && n.children.length > 0;

  function place(node: TreeNode, center: { x: number; y: number }) {
    if (!isOpen(node)) return;
    const N = node.children.length;
    const theta = (Math.PI * 2) / N;
    const selfR = radiusOf(node.id);
    // 取最长的框（子节点里最大的半对角线）
    const maxChildR = Math.max(...node.children.map((c) => radiusOf(c.id)));

    // 父与子相切
    let r = selfR + maxChildR;
    // 相邻子相切（弦长）
    if (N > 1) r = Math.max(r, maxChildR / Math.sin(theta / 2));

    circles.set(node.id, r + maxChildR);

    node.children.forEach((child, i) => {
      const angle = dragged.get(child.id) ?? -Math.PI / 2 + i * theta;
      const pos = {
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      };
      positions.set(child.id, pos);
      parents.set(child.id, node.id);
      radii.set(child.id, r);
      angles.set(child.id, angle);
      arcs.set(child.id, spanAt(r, radiusOf(child.id)));
      place(child, pos);
    });
  }

  for (const root of roots) {
    positions.set(root.id, { x: 0, y: 0 });
    parents.set(root.id, null);
    radii.set(root.id, 0);
    angles.set(root.id, 0);
    arcs.set(root.id, Math.PI * 2);
    circles.set(root.id, radiusOf(root.id));
    place(root, { x: 0, y: 0 });
  }

  return { positions, parents, radii, angles, circles, arcs };
}

/**
 * 拖拽碰撞：给一个期望角度，找最近的不与兄弟重叠的角度。
 */
export function resolveAngle(
  desired: number,
  id: string,
  siblings: { id: string; angle: number; span: number }[],
  selfSpan: number,
): number {
  const norm = (a: number) => {
    let x = a % (Math.PI * 2);
    if (x < 0) x += Math.PI * 2;
    return x;
  };
  const others = siblings
    .filter((s) => s.id !== id)
    .map((s) => ({ lo: norm(s.angle - s.span / 2), hi: norm(s.angle + s.span / 2) }));

  const half = selfSpan / 2;
  const want = norm(desired);

  const overlaps = (a: number) => {
    const lo = norm(a - half);
    const hi = norm(a + half);
    for (const o of others) {
      const wrapA = lo > hi, wrapB = o.lo > o.hi;
      const inRange = (x: number, l: number, h: number, w: boolean) =>
        w ? x >= l || x <= h : x >= l && x <= h;
      if (inRange(o.lo, lo, hi, wrapA) || inRange(o.hi, lo, hi, wrapA) ||
          inRange(lo, o.lo, o.hi, wrapB) || inRange(hi, o.lo, o.hi, wrapB)) return true;
    }
    return false;
  };

  if (!overlaps(want)) return want;

  const step = Math.PI / 180;
  for (let k = 1; k <= 180; k++) {
    const a = norm(want + k * step);
    if (!overlaps(a)) return a;
    const b = norm(want - k * step);
    if (!overlaps(b)) return b;
  }
  return want;
}
