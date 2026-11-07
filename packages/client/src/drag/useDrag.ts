import { useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { CONTENT_PREFIX, CONTENT_SIZE, ellipsesOverlap, resolveAngle, spanAt, type LayoutResult } from "../layout/radial.ts";

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
  sizes: Map<string, { width: number; height: number }>;
  setDragged: (fn: (prev: Map<string, number>) => Map<string, number>) => void;
  contentPos: Map<string, { x: number; y: number }>;
  setContentPos: (fn: (prev: Map<string, { x: number; y: number }>) => Map<string, { x: number; y: number }>) => void;
}

export function useDrag({ layout, sizes, setDragged, contentPos, setContentPos }: Options) {
  const { screenToFlowPosition } = useReactFlow();
  const state = useRef<DragState | null>(null);
  const latest = useRef({ layout, sizes, contentPos, setDragged, setContentPos });
  latest.current = { layout, sizes, contentPos, setDragged, setContentPos };

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
        const { contentPos, sizes } = latest.current;
        let next = { x: s.start.x + dx, y: s.start.y + dy };
        // 内容节点椭圆碰撞：用**实际尺寸**（用户调过大小），重叠时沿中心连线推开
        const mySize = sizes.get(CONTENT_PREFIX + s.id) ?? CONTENT_SIZE;
        for (const [id, pos] of contentPos) {
          if (id === s.id) continue;
          const otherSize = sizes.get(CONTENT_PREFIX + id) ?? CONTENT_SIZE;
          if (ellipsesOverlap(next, mySize, pos, otherSize)) {
            const ang = Math.atan2(next.y - pos.y, next.x - pos.x);
            const need = (mySize.width + mySize.height) / 2 + (otherSize.width + otherSize.height) / 2;
            next = { x: pos.x + Math.cos(ang) * need, y: pos.y + Math.sin(ang) * need };
          }
        }
        latest.current.setContentPos((prev) => {
          const map = new Map(prev);
          map.set(s.id, next);
          return map;
        });
        return;
      }

      const { layout } = latest.current;
      const want = Math.atan2(p.y - s.center.y, p.x - s.center.x);
      // 同父的所有兄弟（含自己）的角度区间
      const parentId = layout.parents.get(s.id);
      const siblings: { id: string; angle: number; span: number }[] = [];
      for (const [id, pid] of layout.parents) {
        if (pid !== parentId) continue;
        const angle = id === s.id ? want : layout.angles.get(id);
        const span = layout.arcs.get(id);
        if (angle === undefined || span === undefined) continue;
        siblings.push({ id, angle, span });
      }
      const selfR = layout.radii.get(s.id) ?? 100;
      const selfSize = sizes.get(s.id) ?? { width: 120, height: 36 };
      const selfSpan = spanAt(selfR, Math.hypot(selfSize.width, selfSize.height) / 2);

      // 拖拽时：自己被拖到鼠标角度；其他兄弟按原角度顺序**让位**（顺时针排开），
      // 保证每个兄弟的区间 [angle-span/2, angle+span/2] 不重叠。
      const norm = (a: number) => {
        let x = a % (Math.PI * 2);
        if (x < 0) x += Math.PI * 2;
        return x;
      };
      const others = siblings
        .filter((x) => x.id !== s.id)
        .sort((a, b) => norm(a.angle - want) - norm(b.angle - want));

      latest.current.setDragged((prev) => {
        const next = new Map(prev);
        next.set(s.id, want);
        // 从被拖节点的顺时针一侧开始，依次排开
        let acc = want + selfSpan / 2;
        for (const o of others) {
          acc += o.span / 2;
          next.set(o.id, acc);
          acc += o.span / 2;
        }
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
