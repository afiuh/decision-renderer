import { useCallback, useEffect, useState } from "react";

interface DirEntry {
  name: string;
  path: string;
}

interface Props {
  mode: "import" | "create";
  onClose: () => void;
  onDone: () => void;
}

export function DirectoryPicker({ mode, onClose, onDone }: Props) {
  const [cwd, setCwd] = useState("");
  const [parent, setParent] = useState<string | null>(null);
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const browse = useCallback(async (target?: string) => {
    try {
      const res = await fetch("/api/fs" + (target ? "?path=" + encodeURIComponent(target) : ""));
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCwd(data.path);
      setParent(data.parent);
      setDirs(data.dirs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void browse();
  }, [browse]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = mode === "import" ? "/api/projects" : "/api/projects/create";
      const body = mode === "import" ? { path: cwd } : { parent: cwd, name: name.trim() };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const mkdir = async () => {
    const n = window.prompt("新文件夹名称");
    if (!n) return;
    const res = await fetch("/api/fs/mkdir", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parent: cwd, name: n }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    else void browse(cwd);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <span>{mode === "import" ? "导入项目" : "新建项目"}</span>
          <button onClick={onClose}>×</button>
        </header>

        <div className="crumb">
          <button onClick={() => parent && browse(parent)} disabled={!parent}>↑</button>
          <span title={cwd}>{cwd}</span>
          <button onClick={mkdir}>新建文件夹</button>
        </div>

        <ul className="dir-list">
          {dirs.map((d) => (
            <li key={d.path}>
              <button onClick={() => browse(d.path)}>{d.name}</button>
            </li>
          ))}
          {dirs.length === 0 && <li className="empty">空目录</li>}
        </ul>

        {mode === "create" && (
          <label className="field">
            项目名称
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 新项目" autoFocus />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <footer>
          <span className="hint">
            {mode === "import" ? "选中一个决策网络目录" : "在当前目录下创建"}
          </span>
          <button className="primary" disabled={busy || (mode === "create" && !name.trim())} onClick={confirm}>
            {mode === "import" ? "导入此目录" : "创建项目"}
          </button>
        </footer>
      </div>
    </div>
  );
}
