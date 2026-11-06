import { useState } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import type { NodeContent } from '../../../shared/types'

export function ContentNode({ data }: NodeProps) {
  const node = data.node as NodeContent
  const workspace = String(data.workspace ?? 'dshiunx')
  const onClose = data.onClose as () => void
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(node.markdown)
  const [saving, setSaving] = useState(false)

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await fetch(`/api/node/${encodeURIComponent(node.id)}?workspace=${encodeURIComponent(workspace)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ markdown: text }),
      })
      setEditing(false)
    } finally { setSaving(false) }
  }

  return (
    <div className="content-node">
      <NodeResizer minWidth={320} minHeight={200} isVisible />
      <Handle type="target" position={Position.Top} />
      <div className="window-head">
        <span>{node.title}</span>
        <div className="window-actions">
          {editing ? (<><button onClick={() => { setText(node.markdown); setEditing(false) }}>取消</button><button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button></>) : (<button onClick={() => setEditing(true)}>编辑</button>)}
          <button onClick={onClose}>×</button>
        </div>
      </div>
      <div className="window-body">
        {editing ? <CodeMirror value={text} onChange={setText} extensions={[markdown()]} height="100%" basicSetup={{ lineNumbers: false }} /> : <Markdown remarkPlugins={[remarkGfm]}>{node.markdown}</Markdown>}
      </div>
    </div>
  )
}
