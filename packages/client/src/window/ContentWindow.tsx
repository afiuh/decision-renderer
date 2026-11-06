import { useState } from 'react'
import { Rnd } from 'react-rnd'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import type { NodeContent } from '../../../shared/types'

export function ContentWindow({ node, onClose, onSaved }: {
  node: NodeContent
  onClose: () => void
  onSaved?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(node.markdown)
  const [saving, setSaving] = useState(false)

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await fetch(`/api/node/${encodeURIComponent(node.id)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markdown: text }),
      })
      setEditing(false)
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Rnd
      default={{ x: Math.max(320, window.innerWidth - 600), y: 80, width: 560, height: 460 }}
      minWidth={320}
      minHeight={200}
      className="content-window"
    >
      <div className="window-head">
        <span>{node.title}</span>
        <div className="window-actions">
          {editing ? (
            <>
              <button onClick={() => { setText(node.markdown); setEditing(false) }}>取消</button>
              <button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}>编辑</button>
          )}
          <button onClick={onClose}>×</button>
        </div>
      </div>
      <div className="window-body">
        {editing
          ? <CodeMirror value={text} onChange={setText} extensions={[markdown()]} height="100%" basicSetup={{ lineNumbers: false }} />
          : <Markdown remarkPlugins={[remarkGfm]}>{node.markdown}</Markdown>}
      </div>
    </Rnd>
  )
}
