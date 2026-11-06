import { useCallback, useEffect, useRef, useState } from "react";

const enc = (id: string) => id.split("/").map(encodeURIComponent).join("/");

export function useContent(id: string | null, workspace: string) {
  const [markdown, setMarkdown] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<string | null>(null);

  useEffect(() => {
    current.current = id;
    if (!id) {
      setMarkdown("");
      setSaved("");
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/node/${enc(id)}?ws=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data) => {
        if (current.current !== id) return;
        if (data.error) throw new Error(data.error);
        setMarkdown(data.markdown);
        setSaved(data.markdown);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [id, workspace]);

  const save = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/node/${enc(id)}?ws=${encodeURIComponent(workspace)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    else setSaved(markdown);
  }, [id, workspace, markdown]);

  return { markdown, setMarkdown, dirty: markdown !== saved, loading, error, save };
}
