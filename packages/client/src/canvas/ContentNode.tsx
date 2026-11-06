import { useContext, useState } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TreeNode } from "@dr/shared";
import { CanvasContext } from "../drag/DragContext.ts";
import { useContent } from "../content/useContent.ts";

export function ContentNode({ data, selected }: NodeProps) {
  const { node, workspace } = data as unknown as { node: TreeNode; workspace: string };
  const actions = useContext(CanvasContext)!;
  const { markdown: md, setMarkdown, dirty, loading, error, save } = useContent(node.id, workspace);
  const [editing, setEditing] = useState(false);

  return (
    <div className="content-node">
      <NodeResizer minWidth={360} minHeight={240} isVisible={selected} />
      <header>
        <span className="content-title">{node.title}</span>
        <div className="content-actions">
          <button onClick={() => setEditing((v) => !v)}>{editing ? "预览" : "编辑"}</button>
          {editing && (
            <button className="primary" disabled={!dirty} onClick={save}>
              {dirty ? "保存" : "已保存"}
            </button>
          )}
          <button onClick={() => actions.rename(node.id, node.title)}>重命名</button>
          <button onClick={() => actions.remove(node.id)}>删除</button>
          <button onClick={actions.close}>×</button>
        </div>
      </header>
      <div className="content-body nodrag nowheel">
        {loading && <p className="hint">加载中…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (editing ? (
          <CodeMirror
            value={md}
            height="100%"
            extensions={[markdown()]}
            onChange={setMarkdown}
          />
        ) : (
          <div className="markdown">
            <Markdown remarkPlugins={[remarkGfm]}>{md}</Markdown>
          </div>
        ))}
      </div>
    </div>
  );
}
