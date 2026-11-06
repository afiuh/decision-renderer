import { useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import type { LayoutResult } from "../layout/radial.ts";

interface DragState {
  id: string;
  parentId: string;
  center: { x: number; y: number };
}

export function useDrag(layout: LayoutResult, setDragged: (fn: (prev: Map<string, number>) => Map<string, number>) => void) {
  const { screenToFlowPosition } = useReactFlow();
  const state = useRef<DragState | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent, id: string) => {
      const parentId = layout.parents.get(id);
      if (!parentId) return;
      const parent = layout.positions.get(parentId);
      if (!parent) return;
      event.stopPropagation();
      state.current = { id, parentId, center: parent };
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    },
    [layout],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const s = state.current;
      if (!s) return;
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const angle = Math.atan2(p.y - s.center.y, p.x - s.center.x);
      setDragged((prev) => {
        const next = new Map(prev);
        next.set(s.id, angle);
        return next;
      });
    },
    [screenToFlowPosition, setDragged],
  );

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (!state.current) return;
    state.current = null;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}
