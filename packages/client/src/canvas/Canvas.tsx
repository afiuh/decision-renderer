import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import type { TreeNode } from "@dr/shared";
import { CanvasContext, type CanvasActions } from "../drag/DragContext.ts";
import { useDrag } from "../drag/useDrag.ts";
import { useFitView } from "../layout/useFitView.ts";
import { useLayout } from "../layout/useLayout.ts";
import { CONTENT_PREFIX, CONTENT_SIZE } from "../layout/radial.ts";
import { flatten, useEdges, useNodes } from "../layout/useNodes.ts";
import { loadCanvas, saveCanvas } from "../state/canvasState.ts";
import { ContentNode } from "./ContentNode.tsx";
import { FloatingEdge } from "./FloatingEdge.tsx";
import { NodeCard } from "./NodeCard.tsx";

const nodeTypes: NodeTypes = { card: NodeCard, content: ContentNode };
const edgeTypes = { floating: FloatingEdge };

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const SCRUB_SPEED = 400;

export interface CanvasHandle {
  createChild: () => void;
  openNode: (id: string) => void;
}

interface Props {
  project: string;
  tree: TreeNode[];
  onSelect?: (id: string | null) => void;
  handleRef?: { current: CanvasHandle | null };
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function Canvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ project, tree, onSelect, handleRef }: Props) {
  const saved = useMemo(() => loadCanvas(project), [project]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(saved.expanded ?? []));
  const [sizes, setSizes] = useState<Map<string, { width: number; height: number }>>(new Map());
  const [dragged, setDragged] = useState<Map<string, number>>(
    () => new Map(Object.entries(saved.dragged ?? {})),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [contentIds, setContentIds] = useState<Set<string>>(() => new Set(saved.contentIds ?? []));
  const [contentPos, setContentPos] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(Object.entries(saved.contentPos ?? {})),
  );
  const [viewport, setViewport] = useState(saved.viewport ?? null);

  const index = useMemo(() => new Map(flatten(tree).map((n) => [n.id, n])), [tree]);
  const layout = useLayout(tree, expanded, sizes, dragged);
  const nodes = useNodes(layout, index, expanded, sizes, selected, contentIds, contentPos);
  const edges = useEdges(layout, expanded, index, contentIds);
  const drag = useDrag({ layout, sizes, setDragged, contentPos, setContentPos });

  // 首次进入且没保存过展开集时，默认展开根节点
  const initialised = useRef(saved.expanded !== undefined);
  useEffect(() => {
    if (!initialised.current && tree.length > 0) {
      initialised.current = true;
      setExpanded(new Set(tree.map((n) => n.id)));
    }
  }, [tree]);

  // 新打开的内容节点：初始位置放原节点外侧
  useEffect(() => {
    setContentPos((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of contentIds) {
        if (next.has(id)) continue;
        const center = layout.positions.get(id);
        if (!center) continue;
        const size = sizes.get(CONTENT_PREFIX + id) ?? CONTENT_SIZE;
        const nr = Math.hypot(size.width, size.height) / 2;
        const angle = layout.parents.get(id) ? layout.angles.get(id)! : 0;
        const r = nr + 120;
        next.set(id, {
          x: center.x + Math.cos(angle) * r - size.width / 2,
          y: center.y + Math.sin(angle) * r - size.height / 2,
        });
        changed = true;
      }
      for (const id of [...next.keys()]) {
        if (!contentIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [contentIds, layout, sizes]);

  // 持久化（去抖 400ms）
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveCanvas(project, {
        expanded: [...expanded],
        dragged: Object.fromEntries(dragged),
        contentIds: [...contentIds],
        contentPos: Object.fromEntries(contentPos),
        viewport: viewport ?? undefined,
      });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [project, expanded, dragged, contentIds, contentPos, viewport]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const open = useCallback((id: string) => {
    setSelected(id);
    setContentIds((prev) => new Set(prev).add(id));
  }, []);

  const measure = useCallback((id: string, size: { width: number; height: number }) => {
    // 忽略 0 尺寸（测量循环：node.width=0 → 容器 0 → 卡片 0 → 测量 0）
    if (size.width < 1 || size.height < 1) return;
    setSizes((prev) => {
      const old = prev.get(id);
      if (old && Math.abs(old.width - size.width) < 0.5 && Math.abs(old.height - size.height) < 0.5) return prev;
      const next = new Map(prev);
      next.set(id, size);
      return next;
    });
  }, []);

  const createChild = useCallback(async () => {
    if (!selected) {
      window.alert(`先点一个节点，再新建子节点（project=${project}）`);
      return;
    }
    const title = window.prompt("子节点名称");
    if (!title) return;
    const res = await fetch(`/api/node?ws=${encodeURIComponent(project)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parent: selected, title }),
    });
    const data = await res.json();
    if (data.error) window.alert(data.error);
    else setExpanded((prev) => new Set(prev).add(selected));
  }, [selected, project]);

  const openNode = useCallback(
    (id: string) => {
      const chain: string[] = [];
      const find = (list: TreeNode[], trail: string[]): boolean => {
        for (const n of list) {
          const next = [...trail, n.id];
          if (n.id === id) {
            chain.push(...next);
            return true;
          }
          if (find(n.children, next)) return true;
        }
        return false;
      };
      find(tree, []);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const c of chain) next.add(c);
        return next;
      });
      setSelected(id);
      setContentIds((prev) => new Set(prev).add(id));
    },
    [tree],
  );

  const actions: CanvasActions = useMemo(
    () => ({
      drag,
      toggle,
      open,
      close: (id) =>
        setContentIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
      measure,
      rename: (id, title) => {
        const next = window.prompt("新名称", title);
        if (!next || next === title) return;
        fetch(`/api/node/${id.split("/").map(encodeURIComponent).join("/")}?ws=${encodeURIComponent(project)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: next }),
        }).then(() => {
          setContentIds((prev) => {
            const s = new Set(prev);
            s.delete(id);
            return s;
          });
        });
      },
      remove: (id) => {
        if (!window.confirm("删除这个节点？")) return;
        fetch(`/api/node/${id.split("/").map(encodeURIComponent).join("/")}?ws=${encodeURIComponent(project)}`, {
          method: "DELETE",
        }).then((r) =>
          r.json().then((d) => {
            if (d.error) window.alert(d.error);
            else
              setContentIds((prev) => {
                const s = new Set(prev);
                s.delete(id);
                return s;
              });
          }),
        );
      },
    }),
    [drag, toggle, open, measure, project],
  );

  useEffect(() => {
    onSelect?.(selected);
  }, [selected, onSelect]);

  if (handleRef) {
    handleRef.current = { createChild, openNode };
  }

  const decorated = useMemo(
    () => nodes.map((n) => (n.type === "content" ? { ...n, data: { ...n.data, workspace: project } } : n)),
    [nodes, project],
  );

  if (tree.length === 0) {
    return (
      <div className="canvas-empty">
        <p>没有可显示的节点</p>
        <p className="hint">
          这个目录里没有根节点（.md），或者文件树还在加载。根节点必须放在项目根目录，和 <code>X-子节点/</code> 并列。
        </p>
      </div>
    );
  }

  return (
    <CanvasContext.Provider value={actions}>
      <CanvasView
        nodes={decorated}
        edges={edges}
        expanded={expanded}
        tree={tree}
        savedViewport={viewport}
        onViewport={setViewport}
        signature={`${project}|${flatten(tree).length}`}
      />
    </CanvasContext.Provider>
  );
}

interface ViewProps {
  nodes: Node[];
  edges: ReturnType<typeof useEdges>;
  expanded: Set<string>;
  tree: TreeNode[];
  savedViewport: { x: number; y: number; zoom: number } | null;
  onViewport: (v: { x: number; y: number; zoom: number }) => void;
  signature: string;
}

function CanvasView({ nodes, edges, savedViewport, onViewport, signature }: ViewProps) {
  const { fitView, zoomTo, getViewport } = useReactFlow();
  const skipFirst = useRef(Boolean(savedViewport));
  useFitView(signature, skipFirst.current);
  const [space, setSpace] = useState(false);
  const [scrub, setScrub] = useState(false);
  const scrubStart = useRef<{ x: number; zoom: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) setScrub(true);
        else setSpace(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        fitView({ padding: 0.15, maxZoom: 1 });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "1") {
        e.preventDefault();
        zoomTo(1, { duration: 200 });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "Control" || e.key === "Meta") {
        setSpace(false);
        setScrub(false);
        scrubStart.current = null;
      }
    };
    const blur = () => {
      setSpace(false);
      setScrub(false);
      scrubStart.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [fitView, zoomTo]);

  useEffect(() => {
    if (!scrub) return;
    const move = (e: MouseEvent) => {
      if (!scrubStart.current) {
        scrubStart.current = { x: e.clientX, zoom: getViewport().zoom };
        return;
      }
      const dx = e.clientX - scrubStart.current.x;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scrubStart.current.zoom * Math.exp(dx / SCRUB_SPEED)));
      zoomTo(next, { duration: 0 });
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [scrub, getViewport, zoomTo]);

  const className = `canvas${scrub ? " scrubbing" : space ? " grabbing" : ""}`;

  return (
    <div className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        defaultViewport={savedViewport ?? undefined}
        onMoveEnd={(_, vp) => onViewport(vp)}
        panOnDrag={scrub ? false : space ? true : [1, 2]}
        panOnScroll
        panOnScrollSpeed={0.8}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
      >
        <Background gap={24} size={1} color="#e8edf3" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
