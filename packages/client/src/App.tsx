import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TreeNode } from "@dr/shared";
import { Canvas } from "./canvas/Canvas.tsx";
import { Search } from "./canvas/Search.tsx";
import { CanvasContext, type CanvasActions } from "./drag/DragContext.ts";
import { useDrag } from "./drag/useDrag.ts";
import { useLayout } from "./layout/useLayout.ts";
import { CONTENT_PREFIX, CONTENT_SIZE } from "./layout/radial.ts";
import { flatten, useEdges, useNodes } from "./layout/useNodes.ts";

const enc = (id: string) => id.split("/").map(encodeURIComponent).join("/");

export default function App() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sizes, setSizes] = useState<Map<string, { width: number; height: number }>>(new Map());
  const [dragged, setDragged] = useState<Map<string, number>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [contentIds, setContentIds] = useState<Set<string>>(new Set());
  const [contentPos, setContentPos] = useState<Map<string, { x: number; y: number }>>(new Map());
  const initialised = useRef(false);

  const index = useMemo(() => new Map(flatten(tree).map((n) => [n.id, n])), [tree]);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${proto}//${location.host}/ws`);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "hello") {
        setWorkspaces(msg.workspaces ?? []);
        setWorkspace((current) => current || msg.workspaces?.[0] || "");
        setTree(msg.trees?.[msg.workspaces?.[0]] ?? []);
      } else if (msg.type === "tree") {
        setWorkspace((current) => {
          if (msg.workspace === current) setTree(msg.tree);
          return current;
        });
      }
    };
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (!initialised.current && tree.length > 0) {
      initialised.current = true;
      setExpanded(new Set(tree.map((n) => n.id)));
    }
  }, [tree]);

  const layout = useLayout(tree, expanded, sizes, dragged);
  const nodes = useNodes(layout, index, expanded, sizes, selected, contentIds, contentPos);
  const edges = useEdges(layout, expanded, index, contentIds);
  const drag = useDrag({ layout, setDragged, contentPos, setContentPos });

  // 新打开的内容节点：初始位置放在原节点外侧；已拖过的保持不动
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
    setSizes((prev) => {
      const old = prev.get(id);
      if (old && Math.abs(old.width - size.width) < 0.5 && Math.abs(old.height - size.height) < 0.5) return prev;
      const next = new Map(prev);
      next.set(id, size);
      return next;
    });
  }, []);

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
        fetch(`/api/node/${enc(id)}?ws=${encodeURIComponent(workspace)}`, {
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
        fetch(`/api/node/${enc(id)}?ws=${encodeURIComponent(workspace)}`, { method: "DELETE" }).then((r) =>
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
    [drag, toggle, open, measure, workspace],
  );

  const createChild = useCallback(async () => {
    if (!selected) {
      window.alert("先点一个节点，再新建子节点");
      return;
    }
    const title = window.prompt("子节点名称");
    if (!title) return;
    const res = await fetch(`/api/node?ws=${encodeURIComponent(workspace)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parent: selected, title }),
    });
    const data = await res.json();
    if (data.error) window.alert(data.error);
    else setExpanded((prev) => new Set(prev).add(selected));
  }, [selected, workspace]);

  const pickHit = useCallback(
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

  const signature = useMemo(
    () => `${workspace}|${flatten(tree).length}`,
    [workspace, tree],
  );

  return (
    <CanvasContext.Provider value={actions}>
      <div className="app">
        <header className="toolbar">
          <span className="brand">决策网络</span>
          <select value={workspace} onChange={(e) => setWorkspace(e.target.value)}>
            {workspaces.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <button onClick={createChild}>新建子节点</button>
          <span className="spacer" />
          <Search workspace={workspace} onPick={pickHit} />
        </header>
        <Canvas nodes={nodes} edges={edges} signature={signature} workspace={workspace} contentIds={contentIds} />
      </div>
    </CanvasContext.Provider>
  );
}
