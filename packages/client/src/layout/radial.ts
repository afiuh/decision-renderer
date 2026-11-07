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
  /** 每个节点自己的外接圆半径（以自身中心为圆心） */
  circles: Map<string, number>;
  /** 每个节点占用的角度区间（弧度） */
  arcs: Map<string, number>;
}

/** 框的半对角线：中心到框上最远点 */
function halfDiagonal(size: { width: number; height: number }) {
  return Math.hypot(size.width, size.height) / 2;
}

/** 内切椭圆：a = w/2，b = h/2（框包住椭圆） */
export function ellipseOf(size: { width: number; height: number }) {
  return { a: size.width / 2, b: size.height / 2 };
}

/** 两个轴对齐椭圆是否重叠（缩放到单位圆做圆碰撞） */
export function ellipsesOverlap(
  p1: { x: number; y: number }, s1: { width: number; height: number },
  p2: { x: number; y: number }, s2: { width: number; height: number },
): boolean {
  const e1 = ellipseOf(s1), e2 = ellipseOf(s2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  // 近似：用各自椭圆的平均半径缩放
  const ra = (e1.a + e1.b) / 2;
  const rb = (e2.a + e2.b) / 2;
  return Math.hypot(dx, dy) < ra + rb;
}

/** 框在距离 r 处占的角度区间（切线角，角点贴圆） */
function arcAt(r: number, halfDiag: number) {
  if (r <= halfDiag) return Math.PI;
  return 2 * Math.atan(halfDiag / Math.sqrt(Math.max(1e-6, r * r - halfDiag * halfDiag)));
}

export function radialLayout({ roots, expanded, sizes, dragged }: LayoutInput): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  const parents = new Map<string, string | null>();
  const radii = new Map<string, number>();
  const angles = new Map<string, number>();
  const circles = new Map<string, number>();
  const arcs = new Map<string, number>();

  const sizeOf = (id: string) => sizes.get(id) ?? DEFAULT_SIZE;
  const halfOf = (id: string) => halfDiagonal(sizeOf(id));
  const isOpen = (n: TreeNode) => expanded.has(n.id) && n.children.length > 0;

  /** 节点自身的外接圆半径（含所有展开的后代） */
  function measureCircle(node: TreeNode): number {
    const self = halfOf(node.id);
    if (!isOpen(node)) {
      circles.set(node.id, self);
      return self;
    }
    const kids = node.children.map((c) => ({ node: c, r: measureCircle(c) }));
    // 半径自适应：让所有子节点的角度区间总和 ≤ 2π
    let r0 = self + GAP;
    for (let iter = 0; iter < 32; iter++) {
      const total = kids.reduce((s, k) => s + arcAt(Math.max(r0, k.r + self + GAP), k.r), 0);
      if (total <= Math.PI * 2) break;
      r0 *= total / (Math.PI * 2);
    }
    let outer = self;
    for (const k of kids) {
      const d = Math.max(r0, k.r + self + GAP);
      outer = Math.max(outer, d + k.r);
    }
    circles.set(node.id, outer);
    return outer;
  }

  function placeChildren(parent: TreeNode, center: { x: number; y: number }) {
    if (!isOpen(parent)) return;
    const self = halfOf(parent.id);
    const kids = parent.children
      .map((node) => ({ node, r: circles.get(node.id) ?? measureCircle(node) }))
      .sort((a, b) => b.r - a.r);

    // 自适应半径
    let r0 = self + GAP;
    for (let iter = 0; iter < 32; iter++) {
      const total = kids.reduce((s, k) => s + arcAt(Math.max(r0, k.r + self + GAP), k.r), 0);
      if (total <= Math.PI * 2) break;
      r0 *= total / (Math.PI * 2);
    }

    // 每个子节点的角度区间
    const spans = kids.map((k) => {
      const d = Math.max(r0, k.r + self + GAP);
      return { ...k, d, span: arcAt(d, k.r) };
    });
    const totalSpan = spans.reduce((s, k) => s + k.span, 0);
    const pad = Math.max(0, Math.PI * 2 - totalSpan) / Math.max(1, spans.length);

    let acc = -Math.PI / 2;
    for (const k of spans) {
      const mid = acc + (k.span + pad) / 2;
      acc += k.span + pad;

      const angle = dragged.get(k.node.id) ?? mid;
      const pos = {
        x: center.x + Math.cos(angle) * k.d,
        y: center.y + Math.sin(angle) * k.d,
      };
      positions.set(k.node.id, pos);
      parents.set(k.node.id, parent.id);
      radii.set(k.node.id, k.d);
      angles.set(k.node.id, angle);
      arcs.set(k.node.id, k.span);
      placeChildren(k.node, pos);
    }
  }

  for (const root of roots) measureCircle(root);

  if (roots.length === 1) {
    const root = roots[0];
    positions.set(root.id, { x: 0, y: 0 });
    parents.set(root.id, null);
    radii.set(root.id, 0);
    angles.set(root.id, 0);
    arcs.set(root.id, Math.PI * 2);
    placeChildren(root, { x: 0, y: 0 });
  } else if (roots.length > 1) {
    const kids = roots
      .map((node) => ({ node, r: circles.get(node.id) ?? measureCircle(node) }))
      .sort((a, b) => b.r - a.r);
    let r0 = 1;
    for (let iter = 0; iter < 32; iter++) {
      const total = kids.reduce((s, k) => s + arcAt(Math.max(r0, k.r + GAP), k.r), 0);
      if (total <= Math.PI * 2) break;
      r0 *= total / (Math.PI * 2);
    }
    const spans = kids.map((k) => {
      const d = Math.max(r0, k.r + GAP);
      return { ...k, d, span: arcAt(d, k.r) };
    });
    const totalSpan = spans.reduce((s, k) => s + k.span, 0);
    const pad = Math.max(0, Math.PI * 2 - totalSpan) / Math.max(1, spans.length);
    let acc = -Math.PI / 2;
    for (const k of spans) {
      const angle = acc + (k.span + pad) / 2;
      acc += k.span + pad;
      const pos = { x: Math.cos(angle) * k.d, y: Math.sin(angle) * k.d };
      positions.set(k.node.id, pos);
      parents.set(k.node.id, null);
      radii.set(k.node.id, k.d);
      angles.set(k.node.id, angle);
      arcs.set(k.node.id, k.span);
      placeChildren(k.node, pos);
    }
  }

  return { positions, parents, radii, angles, circles, arcs };
}

/**
 * 拖拽碰撞：给一个期望角度，找最近的不与兄弟重叠的角度。
 * 兄弟的角度区间 = [angle - span/2, angle + span/2]。
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
    .map((s) => ({ lo: norm(s.angle - s.span / 2), hi: norm(s.angle + s.span / 2), span: s.span }));

  const half = selfSpan / 2;
  const want = norm(desired);

  // 检查是否与任何兄弟重叠
  const overlaps = (a: number) => {
    const lo = norm(a - half);
    const hi = norm(a + half);
    for (const o of others) {
      // 环形区间相交
      const aLo = lo, aHi = hi, bLo = o.lo, bHi = o.hi;
      const wrapA = aLo > aHi, wrapB = bLo > bHi;
      const inRange = (x: number, l: number, h: number, w: boolean) =>
        w ? x >= l || x <= h : x >= l && x <= h;
      if (inRange(bLo, aLo, aHi, wrapA) || inRange(bHi, aLo, aHi, wrapA) ||
          inRange(aLo, bLo, bHi, wrapB) || inRange(aHi, bLo, bHi, wrapB)) return true;
    }
    return false;
  };

  if (!overlaps(want)) return want;

  // 向两侧搜索最近的不重叠角度
  const step = Math.PI / 180;
  for (let k = 1; k <= 180; k++) {
    const a = norm(want + k * step);
    if (!overlaps(a)) return a;
    const b = norm(want - k * step);
    if (!overlaps(b)) return b;
  }
  return want;
}
