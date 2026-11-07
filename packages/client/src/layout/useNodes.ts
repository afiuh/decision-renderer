import { useMemo, useRef } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { TreeNode } from "@dr/shared";
import { CONTENT_PREFIX, CONTENT_SIZE, DEFAULT_SIZE, type LayoutResult } from "./radial.ts";

export function flatten(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

export function useNodes(
  layout: LayoutResult,
  index: Map<string, TreeNode>,
  expanded: Set<string>,
  sizes: Map<string, { width: number; height: number }>,
  selected: string | null,
  contentIds: Set<string>,
  contentPos: Map<string, { x: number; y: number }>,
) {
  const cache = useRef(new Map<string, Node>());

  return useMemo(() => {
    const nodes: Node[] = [];
    const next = new Map<string, Node>();

    for (const [id, center] of layout.positions) {
      const node = index.get(id);
      if (!node) continue;
      const size = sizes.get(id) ?? DEFAULT_SIZE;
      const key = [id, center.x.toFixed(1), center.y.toFixed(1), expanded.has(id), selected === id, size.width, size.height].join("|");
      let item = cache.current.get(key);
      if (!item) {
        item = {
          id,
          type: "card",
          position: { x: center.x - size.width / 2, y: center.y - size.height / 2 },
          data: { node, expanded: expanded.has(id), selected: selected === id },
          draggable: false,
          width: size.width,
          height: size.height,
          measured: { width: size.width, height: size.height },
        };
      }
      next.set(key, item);
      nodes.push(item);
    }

    for (const id of contentIds) {
      const node = index.get(id);
      const pos = contentPos.get(id);
      if (!node || !pos) continue;
      const size = sizes.get(CONTENT_PREFIX + id) ?? CONTENT_SIZE;
      const key = [CONTENT_PREFIX + id, pos.x.toFixed(1), pos.y.toFixed(1), size.width, size.height].join("|");
      let item = cache.current.get(key);
      if (!item) {
        item = {
          id: CONTENT_PREFIX + id,
          type: "content",
          position: pos,
          data: { node },
          draggable: false,
          width: size.width,
          height: size.height,
          zIndex: 20,
        };
      }
      next.set(key, item);
      nodes.push(item);
    }

    cache.current = next;
    return nodes;
  }, [layout, index, expanded, sizes, selected, contentIds, contentPos]);
}

export function useEdges(
  layout: LayoutResult,
  expanded: Set<string>,
  index: Map<string, TreeNode>,
  contentIds: Set<string>,
) {
  return useMemo(() => {
    const edges: Edge[] = [];
    for (const [id, parentId] of layout.parents) {
      if (!parentId) continue;
      const parent = index.get(parentId);
      if (!parent || !expanded.has(parentId)) continue;
      edges.push({
        id: `e:${parentId}->${id}`,
        source: parentId,
        target: id,
        type: "floating",
        style: { stroke: "#c9d3e0", strokeWidth: 1 },
        zIndex: 0,
      });
    }
    for (const id of contentIds) {
      if (!index.has(id)) continue;
      edges.push({
        id: `e:${id}->${CONTENT_PREFIX}${id}`,
        source: id,
        target: CONTENT_PREFIX + id,
        type: "floating",
        style: { stroke: "#9fb3cc", strokeWidth: 1, strokeDasharray: "4 3" },
        zIndex: 0,
      });
    }
    return edges;
  }, [layout, expanded, index, contentIds]);
}
