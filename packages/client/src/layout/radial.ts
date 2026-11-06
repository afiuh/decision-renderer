import type { TreeNode } from "@dr/shared";

export const GAP = 40;
export const DEFAULT_SIZE = { width: 120, height: 36 };
export const CONTENT_SIZE = { width: 560, height: 440 };
export const CONTENT_PREFIX = "content:";

export interface LayoutInput {
  roots: TreeNode[];
  expanded: Set<string>;
  sizes: Map<string, { width: number; height: number }>;
  /** 用户拖过的角度（弧度），拖动后持久保留 */
  dragged: Map<string, number>;
  /** 当前打开内容节点的原节点 id */
  contentId?: string | null;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  parents: Map<string, string | null>;
  radii: Map<string, number>;
  angles: Map<string, number>;
}

export function radialLayout({ roots, expanded, sizes, dragged, contentId }: LayoutInput): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  const parents = new Map<string, string | null>();
  const radii = new Map<string, number>();
  const angles = new Map<string, number>();

  const sizeOf = (id: string) => sizes.get(id) ?? DEFAULT_SIZE;
  const cardRadius = (id: string) => Math.hypot(sizeOf(id).width, sizeOf(id).height) / 2;
  const isOpen = (n: TreeNode) => expanded.has(n.id) && n.children.length > 0;

  const footprints = new Map<string, number>();
  const circleR = new Map<string, number>();

  function measureFootprint(node: TreeNode): number {
    const fp = isOpen(node) ? 1 + node.children.reduce((s, c) => s + measureFootprint(c), 0) : 1;
    footprints.set(node.id, fp);
    return fp;
  }

  function measureCircle(node: TreeNode): number {
    const cr = isOpen(node)
      ? Math.max(...node.children.map(measureCircle)) + cardRadius(node.id) + GAP
      : cardRadius(node.id);
    circleR.set(node.id, cr);
    return cr;
  }

  function placeChildren(parent: TreeNode, center: { x: number; y: number }) {
    if (!isOpen(parent)) return;
    const items = parent.children
      .map((node) => ({
        node,
        nr: isOpen(node) ? circleR.get(node.id)! : cardRadius(node.id),
        weight: footprints.get(node.id)!,
      }))
      .sort((a, b) => b.weight - a.weight);

    const totalArc = items.reduce((s, it) => s + 2 * it.nr + GAP, 0);
    const r0 = Math.max(1, totalArc / (2 * Math.PI));
    const parentR = cardRadius(parent.id);

    let acc = -Math.PI / 2;
    for (const it of items) {
      const arc = 2 * it.nr + GAP;
      const mid = acc + arc / (2 * r0);
      acc += arc / r0;

      const angle = dragged.get(it.node.id) ?? mid;
      const r = Math.max(r0, it.nr + parentR + GAP);
      const pos = {
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      };
      positions.set(it.node.id, pos);
      parents.set(it.node.id, parent.id);
      radii.set(it.node.id, r);
      angles.set(it.node.id, angle);
      placeChildren(it.node, pos);
    }
  }

  for (const root of roots) {
    measureFootprint(root);
    measureCircle(root);
  }

  if (roots.length === 1) {
    const root = roots[0];
    positions.set(root.id, { x: 0, y: 0 });
    parents.set(root.id, null);
    radii.set(root.id, 0);
    angles.set(root.id, 0);
    placeChildren(root, { x: 0, y: 0 });
  } else if (roots.length > 1) {
    const items = roots
      .map((node) => ({ node, nr: circleR.get(node.id)!, weight: footprints.get(node.id)! }))
      .sort((a, b) => b.weight - a.weight);
    const totalArc = items.reduce((s, it) => s + 2 * it.nr + GAP, 0);
    const r0 = Math.max(1, totalArc / (2 * Math.PI));
    let acc = -Math.PI / 2;
    for (const it of items) {
      const arc = 2 * it.nr + GAP;
      const angle = acc + arc / (2 * r0);
      acc += arc / r0;
      const pos = { x: Math.cos(angle) * r0, y: Math.sin(angle) * r0 };
      positions.set(it.node.id, pos);
      parents.set(it.node.id, null);
      radii.set(it.node.id, r0);
      angles.set(it.node.id, angle);
      placeChildren(it.node, pos);
    }
  }

  // 内容节点：布局里的普通节点，挂在原节点外侧最空的方向上
  if (contentId && positions.has(contentId)) {
    const center = positions.get(contentId)!;
    const outward = parents.get(contentId) ? angles.get(contentId)! : freestAngle(contentId);
    const key = CONTENT_PREFIX + contentId;
    const angle = dragged.get(key) ?? outward;
    const size = sizes.get(key) ?? CONTENT_SIZE;
    const nr = Math.hypot(size.width, size.height) / 2;
    const r = cardRadius(contentId) + nr + GAP * 2;

    positions.set(key, {
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    });
    parents.set(key, contentId);
    radii.set(key, r);
    angles.set(key, angle);
  }

  function freestAngle(baseId: string): number {
    const kids: number[] = [];
    for (const [id, p] of parents) {
      if (p === baseId) kids.push(angles.get(id)!);
    }
    if (kids.length === 0) return 0;
    kids.sort((a, b) => a - b);
    let best = 0;
    let bestGap = -1;
    for (let i = 0; i < kids.length; i++) {
      const a = kids[i];
      const b = i + 1 < kids.length ? kids[i + 1] : kids[0] + Math.PI * 2;
      const gap = b - a;
      if (gap > bestGap) {
        bestGap = gap;
        best = a + gap / 2;
      }
    }
    return best;
  }

  return { positions, parents, radii, angles };
}
