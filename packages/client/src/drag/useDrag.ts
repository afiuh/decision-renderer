import { useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { CONTENT_PREFIX, CONTENT_SIZE, DEFAULT_SIZE, pushOutCircle, pushOutRect, type LayoutResult, type Rect } from "../layout/radial.ts";

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
  setDragging?: (v: boolean) => void;
}

export function useDrag({ layout, sizes, setDragged, contentPos, setContentPos, setDragging }: Options) {
  const { screenToFlowPosition } = useReactFlow();
  const state = useRef<DragState | null>(null);
  const latest = useRef({ layout, sizes, contentPos, setDragged, setContentPos, setDragging });
  latest.current = { layout, sizes, contentPos, setDragged, setContentPos, setDragging };

  const onPointerDown = useCallback((event: React.PointerEvent, id: string) => {
    const { layout, contentPos } = latest.current;
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    latest.current.setDragging?.(true);

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

  const rafId = useRef(0);
  const pending = useRef<{ clientX: number; clientY: number } | null>(null);

  const processMove = useCallback(
    (clientX: number, clientY: number) => {
      const s = state.current;
      if (!s) return;
      const p = screenToFlowPosition({ x: clientX, y: clientY });

      if (s.kind === "free") {
        const dx = p.x - s.pointer.x;
        const dy = p.y - s.pointer.y;
        const { contentPos, sizes, layout } = latest.current;
        let next = { x: s.start.x + dx, y: s.start.y + dy };
        const mySize = sizes.get(CONTENT_PREFIX + s.id) ?? CONTENT_SIZE;

        // 障碍物 = 其它内容节点（左上角坐标）+ 所有决策节点（中心 → 左上角）
        const obstacles: Rect[] = [];
        for (const [id, pos] of contentPos) {
          if (id === s.id) continue;
          const sz = sizes.get(CONTENT_PREFIX + id) ?? CONTENT_SIZE;
          obstacles.push({ x: pos.x, y: pos.y, width: sz.width, height: sz.height });
        }
        for (const [id, c] of layout.positions) {
          const sz = sizes.get(id) ?? DEFAULT_SIZE;
          obstacles.push({ x: c.x - sz.width / 2, y: c.y - sz.height / 2, width: sz.width, height: sz.height });
        }

        // 矩形碰撞：沿穿透较浅的轴推出，迭代到不再重叠（推出可能撞上别的）
        for (let iter = 0; iter < 12; iter++) {
          const me: Rect = { x: next.x, y: next.y, width: mySize.width, height: mySize.height };
          let moved = false;
          for (const o of obstacles) {
            const d = pushOutRect(me, o);
            if (!d) continue;
            me.x += d.dx; me.y += d.dy;
            moved = true;
          }
          next = { x: me.x, y: me.y };
          if (!moved) break;
        }
        latest.current.setContentPos((prev) => {
          const map = new Map(prev);
          map.set(s.id, next);
          return map;
        });
        return;
      }

      const { layout, sizes, contentPos } = latest.current;
      const parentId = layout.parents.get(s.id);
      const center = layout.positions.get(parentId ?? "") ?? s.center;
      const selfR = layout.radii.get(s.id) ?? 100;
      const want = Math.atan2(p.y - center.y, p.x - center.x);
      const selfSize = sizes.get(s.id) ?? DEFAULT_SIZE;
      const selfPos = { x: center.x + Math.cos(want) * selfR, y: center.y + Math.sin(want) * selfR };

      // 所有节点的角度（可调）；被拖节点固定为鼠标角度
      const angles = new Map<string, number>(layout.angles);
      angles.set(s.id, want);

      const ids = [...layout.positions.keys()];
      const sizeOf = (id: string) => sizes.get(id) ?? DEFAULT_SIZE;
      const rectAt = (pt: { x: number; y: number }, sz: { width: number; height: number }): Rect => ({
        x: pt.x - sz.width / 2,
        y: pt.y - sz.height / 2,
        width: sz.width,
        height: sz.height,
      });
      const parentOf = (id: string) => layout.parents.get(id) ?? null;

      // 绝对位置 = 递归父位置 + 极坐标（改父角度会带着整棵子树转）
      const computePositions = () => {
        const pos = new Map<string, { x: number; y: number }>();
        const place = (id: string): { x: number; y: number } => {
          const hit = pos.get(id);
          if (hit) return hit;
          const pid = parentOf(id);
          if (!pid) {
            const rootPos = layout.positions.get(id) ?? { x: 0, y: 0 };
            pos.set(id, rootPos);
            return rootPos;
          }
          const c = place(pid);
          const r = layout.radii.get(id) ?? 0;
          const a = angles.get(id) ?? 0;
          const pt = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
          pos.set(id, pt);
          return pt;
        };
        for (const id of ids) place(id);
        return pos;
      };

      // 改一个节点的角度（沿自己的圆轨道移动）；被拖节点和根固定
      const shift = (id: string, dx: number, dy: number, pos: Map<string, { x: number; y: number }>) => {
        if (id === s.id) return;
        const pid = parentOf(id);
        if (!pid) return;
        const pt = pos.get(id);
        const c = pos.get(pid);
        if (!pt || !c) return;
        angles.set(id, Math.atan2(pt.y + dy - c.y, pt.x + dx - c.x));
      };

      // 团与团碰撞：用碰撞圆（父+子组成的围绕结构），父子团天然相切/包含，跳过
      const radiusOfNode = (id: string) => {
        const r = layout.circles.get(id);
        if (r !== undefined) return r;
        const sz = sizeOf(id);
        return Math.hypot(sz.width, sz.height) / 2;
      };
      const isAncestor = (a: string, b: string) => {
        let cur = parentOf(b);
        while (cur) {
          if (cur === a) return true;
          cur = parentOf(cur);
        }
        return false;
      };

      for (let iter = 0; iter < 24; iter++) {
        const pos = computePositions();
        let moved = false;
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const a = ids[i];
            const b = ids[j];
            if (isAncestor(a, b) || isAncestor(b, a)) continue;
            const d = pushOutCircle(pos.get(a)!, radiusOfNode(a), pos.get(b)!, radiusOfNode(b));
            if (!d) continue;
            if (a === s.id) shift(b, -d.dx, -d.dy, pos);
            else if (b === s.id) shift(a, d.dx, d.dy, pos);
            else {
              shift(a, d.dx / 2, d.dy / 2, pos);
              shift(b, -d.dx / 2, -d.dy / 2, pos);
            }
            moved = true;
          }
        }
        if (!moved) break;
      }

      // 内容节点（浮层）：被撞到就整体推开
      if (contentPos.size > 0) {
        const nextContent = new Map(contentPos);
        let changed = false;
        for (let iter = 0; iter < 8; iter++) {
          let moved = false;
          for (const [id, pos] of nextContent) {
            const sz = sizes.get(CONTENT_PREFIX + id) ?? CONTENT_SIZE;
            const d = pushOutRect(
              { x: pos.x, y: pos.y, width: sz.width, height: sz.height },
              rectAt(selfPos, selfSize),
            );
            if (!d) continue;
            nextContent.set(id, { x: pos.x + d.dx, y: pos.y + d.dy });
            changed = true;
            moved = true;
          }
          if (!moved) break;
        }
        if (changed) latest.current.setContentPos(() => nextContent);
      }

      latest.current.setDragged((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, angle] of angles) {
          const old = prev.get(id);
          if (old !== undefined && Math.abs(old - angle) < 1e-4) continue;
          next.set(id, angle);
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [screenToFlowPosition],
  );

  // 指针事件可能一帧来好几次：只保留最新坐标，每帧最多算一次
  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!state.current) return;
      pending.current = { clientX: event.clientX, clientY: event.clientY };
      if (rafId.current) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        const q = pending.current;
        pending.current = null;
        if (q) processMove(q.clientX, q.clientY);
      });
    },
    [processMove],
  );

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (!state.current) return;
    state.current = null;
    latest.current.setDragging?.(false);
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}
