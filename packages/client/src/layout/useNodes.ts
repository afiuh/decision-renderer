import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { TreeNode } from "@dr/shared";
import { DEFAULT_SIZE, type LayoutResult } from "./radial.ts";

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
  contentId: string | null,
) {
  return useMemo(() => {
    const nodes: Node[] = [];
    for (const [id, center] of layout.positions) {
      const node = index.get(id);
      if (!node) continue;
      const size = sizes.get(id) ?? DEFAULT_SIZE;
      nodes.push({
        id,
        type: "card",
        position: { x: center.x - size.width / 2, y: center.y - size.height / 2 },
        data: { node, expanded: expanded.has(id), selected: selected === id },
        draggable: false,
      });
    }

    if (contentId) {
      const parent = index.get(contentId);
      const size = sizes.get(contentId) ?? DEFAULT_SIZE;
      if (parent) {
        nodes.push({
          id: "content:" + contentId,
          type: "content",
          parentId: contentId,
          position: { x: size.width + 40, y: -60 },
          data: { node: parent },
          draggable: true,
          zIndex: 20,
        });
      }
    }

    return nodes;
  }, [layout, index, expanded, sizes, selected, contentId]);
}

export function useEdges(layout: LayoutResult, expanded: Set<string>, index: Map<string, TreeNode>) {
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
    return edges;
  }, [layout, expanded, index]);
}
