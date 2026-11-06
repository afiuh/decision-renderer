import { useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { CONTENT_PREFIX, type LayoutResult } from "../layout/radial.ts";

interface RotateState {
  kind: "rotate";
  id: string;
  center: { x: number; y: number };
}

interface FreeState {
  kind: "free";
  id: string;
  start: { x: number; y: number };
  pointer: { x: number; y: number };
}

type DragState = RotateState | FreeState;

interface Options {
  layout: LayoutResult;
  setDragged: (fn: (prev: Map<string, number>) => Map<string, number>) => void;
  contentPos: Map<string, { x: number; y: number }>;
  setContentPos: (fn: (prev: Map<string, { x: number; y: number }>) => Map<string, { x: number; y: number }>) => void;
}

export function useDrag({ layout, setDragged, contentPos, setContentPos }: Options) {
  const { screenToFlowPosition } = useReactFlow();
  const state = useRef<DragState | null>(null);
  const latest = useRef({ layout, contentPos, setDragged, setContentPos });
  latest.current = { layout, contentPos, setDragged, setContentPos };

  const onPointerDown = useCallback((event: React.PointerEvent, id: string) => {
    const { layout, contentPos } = latest.current;
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);

    if (id.startsWith(CONTENT_PREFIX)) {
      const base = id.slice(CONTENT_PREFIX.length);
      const start = contentPos.get(base);
      if (!start) return;
      state.current = {
        kind: "free",
        id: base,
        start,
        pointer: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      };
      return;
    }

    const parentId = layout.parents.get(id);
    const center = parentId ? layout.positions.get(parentId) : undefined;
    if (!center) return;
    state.current = { kind: "rotate", id, center };
  }, [screenToFlowPosition]);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const s = state.current;
      if (!s) return;
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      if (s.kind === "free") {
        const dx = p.x - s.pointer.x;
        const dy = p.y - s.pointer.y;
        latest.current.setContentPos((prev) => {
          const next = new Map(prev);
          next.set(s.id, { x: s.start.x + dx, y: s.start.y + dy });
          return next;
        });
        return;
      }

      const angle = Math.atan2(p.y - s.center.y, p.x - s.center.x);
      latest.current.setDragged((prev) => {
        const next = new Map(prev);
        next.set(s.id, angle);
        return next;
      });
    },
    [screenToFlowPosition],
  );

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (!state.current) return;
    state.current = null;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}
