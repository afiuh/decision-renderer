import { useContext, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TreeNode } from "@dr/shared";
import { CanvasContext } from "../drag/DragContext.ts";
import { useContent } from "../content/useContent.ts";

export function ContentNode({ id, data, selected }: NodeProps) {
  const { node, workspace } = data as unknown as { node: TreeNode; workspace: string };
  const actions = useContext(CanvasContext)!;
  const { markdown: md, setMarkdown, dirty, loading, error, save } = useContent(node.id, workspace);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      // borderBoxSize 含 padding/border，且不受父容器宽度/zoom 影响
      const b = entry.borderBoxSize?.[0];
      const box = b
        ? { width: b.inlineSize, height: b.blockSize }
        : { width: el.offsetWidth, height: el.offsetHeight };
      actions.measure(id, { width: box.width, height: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, actions]);

  return (
    <div className="content-node" ref={ref}>
      <NodeResizer minWidth={360} minHeight={220} isVisible={selected} />
      <Handle type="target" position={Position.Top} className="rf-handle" />
      <Handle type="source" position={Position.Bottom} className="rf-handle" />
      <header
        onPointerDown={(e) => actions.drag.onPointerDown(e, id)}
        onPointerMove={(e) => actions.drag.onPointerMove(e)}
        onPointerUp={(e) => actions.drag.onPointerUp(e)}
      >
        <span className="content-title">{node.title}</span>
        <div className="content-actions" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => setEditing((v) => !v)}>{editing ? "预览" : "编辑"}</button>
          {editing && (
            <button className="primary" disabled={!dirty} onClick={save}>
              {dirty ? "保存" : "已保存"}
            </button>
          )}
          <button onClick={() => actions.rename(node.id, node.title)}>重命名</button>
          <button onClick={() => actions.remove(node.id)}>删除</button>
          <button onClick={() => actions.close(node.id)}>×</button>
        </div>
      </header>
      <div className="content-body nodrag nowheel">
        {loading && <p className="hint">加载中…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (editing ? (
          <CodeMirror value={md} height="100%" extensions={[markdown()]} onChange={setMarkdown} />
        ) : (
          <div className="markdown">
            <Markdown remarkPlugins={[remarkGfm]}>{md}</Markdown>
          </div>
        ))}
      </div>
    </div>
  );
}
