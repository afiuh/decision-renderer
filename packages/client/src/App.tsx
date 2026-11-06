import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TreeNode } from "@dr/shared";
import { Canvas, type CanvasHandle } from "./canvas/Canvas.tsx";
import { DirectoryPicker } from "./sidebar/DirectoryPicker.tsx";
import { Sidebar } from "./sidebar/Sidebar.tsx";
import { WorkspaceBar } from "./workspace/WorkspaceBar.tsx";

interface Project {
  path: string;
  name: string;
  exists: boolean;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [trees, setTrees] = useState<Record<string, TreeNode[]>>({});
  const [picker, setPicker] = useState<null | "import" | "create">(null);
  const [selected, setSelected] = useState<Record<string, string | null>>({});
  const handles = useRef<Record<string, { current: CanvasHandle | null }>>({});

  const activePath = openPaths[active] ?? null;

  const loadProjects = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((list: Project[]) => setProjects(list))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadProjects();
    fetch("/api/session")
      .then((r) => r.json())
      .then((s: { open: string[]; active: number }) => {
        setOpenPaths(s.open ?? []);
        setActive(Math.min(s.active ?? 0, Math.max(0, (s.open?.length ?? 1) - 1)));
      })
      .catch(() => undefined);
  }, [loadProjects]);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${proto}//${location.host}/ws`);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "hello") {
        setTrees(msg.trees ?? {});
      } else if (msg.type === "tree") {
        setTrees((prev) => ({ ...prev, [msg.workspace]: msg.tree }));
      } else if (msg.type === "projects") {
        setProjects((msg.workspaces ?? []).map((w: { name: string; root: string }) => ({ name: w.name, path: w.root, exists: true })));
      }
    };
    return () => socket.close();
  }, []);

  // 会话持久化（去抖）
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/session", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ open: openPaths, active }),
      }).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [openPaths, active]);

  const openProject = useCallback(
    (path: string) => {
      const i = openPaths.indexOf(path);
      if (i >= 0) {
        setActive(i);
        return;
      }
      setOpenPaths([...openPaths, path]);
      setActive(openPaths.length);
    },
    [openPaths],
  );

  const closeWorkspace = useCallback(
    (index: number) => {
      const next = openPaths.filter((_, i) => i !== index);
      setOpenPaths(next);
      setActive((cur) => Math.max(0, Math.min(cur > index ? cur - 1 : cur, next.length - 1)));
    },
    [openPaths],
  );

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.path] = p.name;
    return map;
  }, [projects]);

  const closeProject = useCallback(
    (path: string) => {
      const i = openPaths.indexOf(path);
      if (i >= 0) closeWorkspace(i);
    },
    [openPaths, closeWorkspace],
  );

  const removeProject = useCallback(
    async (path: string) => {
      if (!window.confirm(`从列表移除「${names[path] ?? path}」？\n只移除记录，不删除磁盘文件。`)) return;
      await fetch(`/api/projects?path=${encodeURIComponent(path)}`, { method: "DELETE" });
      loadProjects();
      const session = await fetch("/api/session").then((r) => r.json());
      setOpenPaths(session.open ?? []);
      setActive(session.active ?? 0);
    },
    [names, loadProjects],
  );

  const onCreateChild = useCallback(() => {
    if (!activePath) return;
    handles.current[activePath]?.current?.createChild();
  }, [activePath]);

  const onPick = useCallback(
    (id: string) => {
      if (!activePath) return;
      handles.current[activePath]?.current?.openNode(id);
    },
    [activePath],
  );

  return (
    <div className="app">
      <WorkspaceBar
        openPaths={openPaths}
        active={active}
        names={names}
        activePath={activePath}
        onSelect={setActive}
        onClose={closeWorkspace}
        onCreateChild={onCreateChild}
        onPick={onPick}
      />
      <div className="body">
        <Sidebar
          projects={projects}
          openPaths={openPaths}
          activePath={activePath}
          onOpen={openProject}
          onClose={closeProject}
          onRemove={removeProject}
          onImport={() => setPicker("import")}
          onCreate={() => setPicker("create")}
        />
        <main className="content">
          {openPaths.map((p, i) => {
            if (!handles.current[p]) handles.current[p] = { current: null };
            return (
              <div key={p} className="pane" style={{ display: i === active ? "block" : "none" }}>
                <Canvas
                  project={p}
                  tree={trees[p] ?? []}
                  handleRef={handles.current[p]}
                  onSelect={(id) => setSelected((prev) => (prev[p] === id ? prev : { ...prev, [p]: id }))}
                />
              </div>
            );
          })}
          {openPaths.length === 0 && (
            <div className="empty-state">
              <p>从左侧打开一个项目</p>
              <p className="hint">或者点「＋」新建、点「导入」选一个已有目录</p>
            </div>
          )}
        </main>
      </div>

      {picker && (
        <DirectoryPicker
          mode={picker}
          onClose={() => setPicker(null)}
          onDone={() => {
            loadProjects();
            fetch("/api/session")
              .then((r) => r.json())
              .then((s) => {
                setOpenPaths(s.open ?? []);
                setActive(s.active ?? 0);
              })
              .catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
