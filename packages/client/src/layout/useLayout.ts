import { useMemo } from "react";
import type { TreeNode } from "@dr/shared";
import { radialLayout } from "./radial.ts";

export function useLayout(
  roots: TreeNode[],
  expanded: Set<string>,
  sizes: Map<string, { width: number; height: number }>,
  dragged: Map<string, number>,
  contentId: string | null,
) {
  return useMemo(
    () => radialLayout({ roots, expanded, sizes, dragged, contentId }),
    [roots, expanded, sizes, dragged, contentId],
  );
}
