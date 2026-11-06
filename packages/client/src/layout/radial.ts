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
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  parents: Map<string, string | null>;
  radii: Map<string, number>;
  angles: Map<string, number>;
}

export function radialLayout({ roots, expanded, sizes, dragged }: LayoutInput): LayoutResult {
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

  return { positions, parents, radii, angles };
}
