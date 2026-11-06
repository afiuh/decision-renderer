import { useCallback, useRef, useState } from "react";

interface Project {
  path: string;
  name: string;
  exists: boolean;
}

interface Props {
  projects: Project[];
  openPaths: string[];
  activePath: string | null;
  onOpen: (path: string) => void;
  onClose: (path: string) => void;
  onRemove: (path: string) => void;
  onImport: () => void;
  onCreate: () => void;
}

const MIN_W = 140;
const MAX_W = 480;
const COLLAPSED_W = 26;

function Arrow({ direction }: { direction: "left" | "right" }) {
  const rotate = direction === "right" ? 90 : 270;
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <path d="M8 4l5 7H3z" />
    </svg>
  );
}

export function Sidebar({ projects, openPaths, activePath, onOpen, onClose, onRemove, onImport, onCreate }: Props) {
  const [width, setWidth] = useState(230);
  const [collapsed, setCollapsed] = useState(false);
  const dragging = useRef(false);

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      if (collapsed) return;
      event.preventDefault();
      dragging.current = true;
      const startX = event.clientX;
      const startW = width;
      const move = (ev: PointerEvent) => {
        setWidth(Math.min(MAX_W, Math.max(MIN_W, startW + ev.clientX - startX)));
      };
      const up = () => {
        dragging.current = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [width, collapsed],
  );

  return (
    <aside className="sidebar" style={{ width: collapsed ? COLLAPSED_W : width }} data-collapsed={collapsed}>
      {!collapsed && (
        <>
          <div className="group-head">
            <span>项目与导入</span>
            <div className="group-actions">
              <button onClick={onCreate} title="新建项目">＋</button>
              <button onClick={onImport} title="导入目录">导入</button>
            </div>
          </div>
          <ul className="project-list">
            {projects.map((p) => {
              const opened = openPaths.includes(p.path);
              return (
                <li key={p.path} className="project-row">
                  <button
                    className={`project${activePath === p.path ? " active" : ""}${p.exists ? "" : " missing"}`}
                    onClick={() => onOpen(p.path)}
                    title={p.path}
                  >
                    <span className="project-name">{p.name}</span>
                    {opened && <span className="badge">已打开</span>}
                    {!p.exists && <span className="badge warn">缺失</span>}
                  </button>
                  <span className="row-actions">
                    {opened && (
                      <button className="row-action" title="关闭项目（保留在列表）" onClick={() => onClose(p.path)}>
                        关
                      </button>
                    )}
                    <button className="row-action danger" title="从列表移除（不删磁盘文件）" onClick={() => onRemove(p.path)}>
                      删
                    </button>
                  </span>
                </li>
              );
            })}
            {projects.length === 0 && <li className="empty">还没有项目，点「导入」选一个目录</li>}
          </ul>
        </>
      )}

      <div className="grip" onPointerDown={startResize} title={collapsed ? "" : "拖动调整宽度"} />
      <button
        className="collapse-edge"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? "展开项目栏" : "收起项目栏"}
      >
        <Arrow direction={collapsed ? "right" : "left"} />
      </button>
    </aside>
  );
}
