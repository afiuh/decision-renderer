import type { TreeNode } from "@dr/shared";

export const GAP = 24;
export const DEFAULT_SIZE = { width: 120, height: 36 };
export const CONTENT_SIZE = { width: 560, height: 440 };
export const CONTENT_PREFIX = "content:";


export interface Rect { x: number; y: number; width: number; height: number }

/** a 被 b 挤出的最小位移（沿穿透较浅的轴）；不重叠返回 null */
export function pushOutRect(a: Rect, b: Rect): { dx: number; dy: number } | null {
  const left = b.x - (a.x + a.width);
  const right = (b.x + b.width) - a.x;
  const up = b.y - (a.y + a.height);
  const down = (b.y + b.height) - a.y;
  if (left >= 0 || right <= 0 || up >= 0 || down <= 0) return null;
  const px = Math.abs(left) < Math.abs(right) ? left : right;
  const py = Math.abs(up) < Math.abs(down) ? up : down;
  return Math.abs(px) <= Math.abs(py) ? { dx: px, dy: 0 } : { dx: 0, dy: py };
}

/** a 被 b 挤出的位移（沿圆心连线）；两圆不相交返回 null */
export function pushOutCircle(
  a: { x: number; y: number }, ra: number,
  b: { x: number; y: number }, rb: number,
): { dx: number; dy: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const need = ra + rb;
  if (dist >= need) return null;
  if (dist < 1e-6) return { dx: -need, dy: 0 };
  const k = (need - dist) / dist;
  return { dx: -dx * k, dy: -dy * k };
}

function rectAt(p: { x: number; y: number }, s: { width: number; height: number }, pad = 0): Rect {
  return {
    x: p.x - s.width / 2 - pad,
    y: p.y - s.height / 2 - pad,
    width: s.width + 2 * pad,
    height: s.height + 2 * pad,
  };
}

/**
 * 全局矩形分离：**所有**节点两两不重叠（跨父、跨子树、跨根都算）。
 * 移动一个节点时带整棵子树一起平移，保持布局结构。
 * 祖先与后代重叠时只移动后代；根节点固定。
 */
export function separateNodes(
  positions: Map<string, { x: number; y: number }>,
  parents: Map<string, string | null>,
  sizes: Map<string, { width: number; height: number }>,
  defaultSize: { width: number; height: number },
  circles: Map<string, number>,
  iterations = 60,
) {
  const kids = new Map<string, string[]>();
  for (const [id, pid] of parents) {
    if (!pid) continue;
    const arr = kids.get(pid);
    if (arr) arr.push(id);
    else kids.set(pid, [id]);
  }
  const sub = new Map<string, Set<string>>();
  const collect = (id: string): Set<string> => {
    const hit = sub.get(id);
    if (hit) return hit;
    const set = new Set<string>([id]);
    for (const c of kids.get(id) ?? []) for (const x of collect(c)) set.add(x);
    sub.set(id, set);
    return set;
  };
  const ids = [...positions.keys()];
  for (const id of ids) collect(id);

  // 移动一个团：团根绕自己的父中心**旋转**（半径不变，延长距离不被破坏），
  // 子树整体跟随平移。根节点直接平移。
  const shift = (id: string, dx: number, dy: number) => {
    const p0 = positions.get(id);
    if (!p0) return;
    const pid = parents.get(id);
    let ddx = dx;
    let ddy = dy;
    if (pid) {
      const c = positions.get(pid);
      if (c) {
        const r = Math.hypot(p0.x - c.x, p0.y - c.y);
        if (r > 1e-6) {
          const a = Math.atan2(p0.y - c.y, p0.x - c.x);
          const tx = -Math.sin(a);
          const ty = Math.cos(a);
          const dTheta = (dx * tx + dy * ty) / r;
          const na = a + dTheta;
          const np = { x: c.x + Math.cos(na) * r, y: c.y + Math.sin(na) * r };
          ddx = np.x - p0.x;
          ddy = np.y - p0.y;
        }
      }
    }
    for (const x of sub.get(id)!) {
      const q = positions.get(x);
      if (q) positions.set(x, { x: q.x + ddx, y: q.y + ddy });
    }
  };
  const roots = new Set(ids.filter((id) => !parents.get(id)));
  const sizeOf = (id: string) => sizes.get(id) ?? defaultSize;
  const radiusOf = (id: string) => circles.get(id) ?? halfDiagonal(sizeOf(id));

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        // 祖先与后代属于同一个团，不做团间分离
        if (sub.get(a)!.has(b) || sub.get(b)!.has(a)) continue;
        // 节点之间留 GAP/2 的间隙，避免卡片贴在一起
        const d = pushOutRect(rectAt(positions.get(a)!, sizeOf(a), GAP / 2), rectAt(positions.get(b)!, sizeOf(b), GAP / 2));
        if (!d) continue;
        if (sub.get(a)!.has(b)) shift(b, -d.dx, -d.dy);          // b 是 a 的后代
        else if (sub.get(b)!.has(a)) shift(a, d.dx, d.dy);       // a 是 b 的后代
        else if (roots.has(a)) shift(b, -d.dx, -d.dy);           // 根不动
        else if (roots.has(b)) shift(a, d.dx, d.dy);
        else { shift(a, d.dx / 2, d.dy / 2); shift(b, -d.dx / 2, -d.dy / 2); }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

export interface LayoutInput {
  roots: TreeNode[];
  expanded: Set<string>;
  sizes: Map<string, { width: number; height: number }>;
  /** 用户拖过的角度（弧度），拖动后持久保留 */
  dragged: Map<string, number>;
  /** 拖拽中：分离迭代降到 8（每帧便宜），松手后回到 60 */
  skipSeparate?: boolean;
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

/** 只按标题长度估算卡片尺寸（渲染前即可用，不依赖实测） */
export function estimateSize(title: string): { width: number; height: number } {
  let w = 0;
  for (const ch of title) {
    // 中文/全角 13px，其余约 7px
    w += /[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 13 : 7;
  }
  // padding 20 + 圆点 6 + 间距 6 + 折叠按钮 12
  return { width: Math.max(60, Math.round(w) + 44), height: 30 };
}

export interface ExpandMetrics {
  /** 父中心 → 子节点中心（连线长度） */
  distance: number;
  /** 父中心 → 最远子节点外沿（团结构碰撞圆半径） */
  circle: number;
}

/**
 * 预运算：整棵树的展开距离 + 团碰撞圆半径。
 * 只依赖节点数和标题长度，渲染前一次算好，后面直接取。
 */
export function precomputeExpandDistances(roots: TreeNode[]): Map<string, ExpandMetrics> {
  const out = new Map<string, ExpandMetrics>();
  const walk = (n: TreeNode) => {
    if (n.children.length > 0) {
      const childSizes = n.children.map((c) => estimateSize(c.title));
      const distance = childDistance(childSizes, estimateSize(n.title));
      const maxChild = Math.max(...childSizes.map((sz) => halfDiagonal(sz)));
      out.set(n.id, { distance, circle: distance + maxChild });
    }
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

/**
 * 展开一个节点时，子节点连线（父中心 → 子节点中心）要多长。
 * 所有子节点取同一个值，取所有相邻对里最长的那个。
 *
 * 子节点在半径 r 的圆上均匀分布，角度间隔 θ = 2π/N，相邻子节点中心距 = 2r·sin(π/N)。
 * 把每个子节点框按对角线取成圆（半径 R_i），要求相邻两个圆至少相切：
 *   2r·sin(π/N) ≥ R_i + R_{i+1}  →  r ≥ (R_i + R_{i+1}) / (2·sin(π/N))
 * 再加一条：父节点自身不能被压住 → r ≥ R_parent + max R_child。
 *
 * 只依赖节点数、尺寸（标题长度），渲染前就能算。
 */
export function childDistance(
  childSizes: { width: number; height: number }[],
  parentSize: { width: number; height: number },
): number {
  const N = childSizes.length;
  if (N === 0) return 0;
  const R = childSizes.map((s) => Math.hypot(s.width, s.height) / 2);
  const parentR = Math.hypot(parentSize.width, parentSize.height) / 2;
  if (N === 1) return parentR + R[0];
  const sinHalf = Math.sin(Math.PI / N);
  let r = 0;
  for (let i = 0; i < N; i++) {
    const a = R[i];
    const b = R[(i + 1) % N];
    r = Math.max(r, (a + b) / (2 * sinHalf));
  }
  return Math.max(r, parentR + Math.max(...R));
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
 * 径向布局：一个节点展开，N 个子节点均匀分布在一个圆上。
 *
 * 连线长度 r 的确定（全部来自预运算，不在布局时现算）：
 *   r = R父 + R子
 *   其中 R = 团结构碰撞圆半径（父中心 → 最远子节点外沿）
 *   也就是：两个团的圆心（父节点中心、子节点中心）距离 = 两个团圆半径之和，
 *   两圆外切。子节点没展开时 R子 = 自身半对角线，展开后 R子 变大 → 连线自动延长。
 *
 * 角度：θ = 2π/N 均匀分布（用户拖拽过的角度优先）。
 */
export function radialLayout({ roots, expanded, sizes, dragged, skipSeparate }: LayoutInput): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  const parents = new Map<string, string | null>();
  const radii = new Map<string, number>();
  const angles = new Map<string, number>();
  const circles = new Map<string, number>();
  const arcs = new Map<string, number>();

  const sizeOf = (id: string) => sizes.get(id) ?? DEFAULT_SIZE;
  const radiusOf = (id: string) => halfDiagonal(sizeOf(id));
  const isOpen = (n: TreeNode) => expanded.has(n.id) && n.children.length > 0;

  // 团碰撞圆半径：**展开时**取预运算值（父中心 → 最远子节点外沿）；
  // 折叠/叶子没有展开的团，半径 = 自身半对角线
  const expandMetrics = precomputeExpandDistances(roots);
  const computeCircles = (n: TreeNode) => {
    const selfR = halfDiagonal(estimateSize(n.title));
    const pre = expandMetrics.get(n.id);
    circles.set(n.id, isOpen(n) && pre ? pre.circle : selfR);
    n.children.forEach(computeCircles);
  };
  for (const root of roots) computeCircles(root);

  function place(node: TreeNode, center: { x: number; y: number }) {
    if (!isOpen(node)) return;
    const N = node.children.length;
    const theta = (Math.PI * 2) / N;
    const selfR = radiusOf(node.id);
    // 连线长度 = 两个团碰撞圆的**圆心距** = 两个半径之和（两圆外切）
    // 子节点展开后 R子 变大，连线自动延长；没展开的保持原距离
    const parentR = circles.get(node.id)!;
    // 折叠的子节点回到预运算原值（展开距离）；展开的子节点才按两团圆半径和延长
    const foldedR = expandMetrics.get(node.id)?.distance;

    node.children.forEach((child, i) => {
      const angle = dragged.get(child.id) ?? -Math.PI / 2 + i * theta;
      const childR = circles.get(child.id)!;
      const r = isOpen(child) || foldedR === undefined ? parentR + childR : foldedR;
      const pos = {
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      };
      positions.set(child.id, pos);
      parents.set(child.id, node.id);
      radii.set(child.id, r);
      angles.set(child.id, angle);
      arcs.set(child.id, spanAt(r, childR));
      place(child, pos);
    });
  }

  for (const root of roots) {
    positions.set(root.id, { x: 0, y: 0 });
    parents.set(root.id, null);
    radii.set(root.id, 0);
    angles.set(root.id, 0);
    arcs.set(root.id, Math.PI * 2);
    place(root, { x: 0, y: 0 });
  }

  // 全局分离：任何两个节点都不许重叠（跨父/跨子树也推）
  // 叶子节点没有预运算条目，碰撞圆 = 自身半对角线
  for (const [id] of positions) {
    if (!circles.has(id)) circles.set(id, radiusOf(id));
  }
  // 碰撞圆在标准布局时就算好了（子节点未因展开/分离而拉远），之后不再重算
  // 拖拽中也分离，只是迭代少（够用且便宜）；静止时用完整迭代
  separateNodes(positions, parents, sizes, DEFAULT_SIZE, circles, skipSeparate ? 8 : 60);

  // 分离后反算每个节点相对父的半径与角度，让拖拽模型与实际位置一致
  for (const [id, pid] of parents) {
    if (!pid) continue;
    const p = positions.get(id);
    const c = positions.get(pid);
    if (!p || !c) continue;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const r = Math.hypot(dx, dy);
    radii.set(id, r);
    angles.set(id, Math.atan2(dy, dx));
    arcs.set(id, spanAt(r, radiusOf(id)));
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
