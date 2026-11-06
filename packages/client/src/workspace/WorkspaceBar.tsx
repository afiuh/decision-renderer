import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "@dr/shared";

interface Props {
  openPaths: string[];
  active: number;
  names: Record<string, string>;
  activePath: string | null;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
  onCreateChild: () => void;
  onPick: (id: string) => void;
}

export function WorkspaceBar({
  openPaths,
  active,
  names,
  activePath,
  onSelect,
  onClose,
  onCreateChild,
  onPick,
}: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim() || !activePath) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&ws=${encodeURIComponent(activePath)}`)
        .then((r) => r.json())
        .then((d) => setHits(d.hits ?? []))
        .catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, activePath]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <header className="workspace-bar">
      <div className="workspaces">
        {openPaths.map((p, i) => (
          <div key={p} className={`ws${i === active ? " active" : ""}`}>
            <button className="ws-num" onClick={() => onSelect(i)} title={p}>
              {i + 1}
            </button>
            <button className="ws-close" onClick={() => onClose(i)} title={`关闭 ${names[p] ?? p}`}>
              ×
            </button>
          </div>
        ))}
        {openPaths.length === 0 && <span className="hint">从左栏打开一个项目</span>}
      </div>

      <span className="spacer" />

      <button className="tool" onClick={onCreateChild} disabled={!activePath}>
        新建子节点
      </button>

      <div className="search" ref={box}>
        <input
          value={q}
          placeholder="搜索当前项目…"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && hits.length > 0 && (
          <ul className="hits">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => {
                    onPick(h.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <strong>{h.title}</strong>
                  <span>{h.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
