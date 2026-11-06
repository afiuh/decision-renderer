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
  onImport: () => void;
  onCreate: () => void;
}

export function Sidebar({ projects, openPaths, activePath, onOpen, onImport, onCreate }: Props) {
  return (
    <aside className="sidebar">
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
            <li key={p.path}>
              <button
                className={`project${activePath === p.path ? " active" : ""}${p.exists ? "" : " missing"}`}
                onClick={() => onOpen(p.path)}
                title={p.path}
              >
                <span className="project-name">{p.name}</span>
                {opened && <span className="badge">已打开</span>}
                {!p.exists && <span className="badge warn">缺失</span>}
              </button>
            </li>
          );
        })}
        {projects.length === 0 && <li className="empty">还没有项目，点「导入」选一个目录</li>}
      </ul>
    </aside>
  );
}
