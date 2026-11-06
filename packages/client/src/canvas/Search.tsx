import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "@dr/shared";

interface Props {
  workspace: string;
  onPick: (id: string) => void;
}

export function Search({ workspace, onPick }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&ws=${encodeURIComponent(workspace)}`)
        .then((r) => r.json())
        .then((d) => setHits(d.hits ?? []))
        .catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, workspace]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="search" ref={box}>
      <input
        value={q}
        placeholder="搜索节点…"
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
  );
}
