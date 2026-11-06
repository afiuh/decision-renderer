import { useCallback, useEffect, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { ContentWindow } from './window/ContentWindow'
import type { NodeContent, TreeEdge, TreeNode } from '../../shared/types'

export function App() {
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [edges, setEdges] = useState<readonly TreeEdge[]>([])
  const [open, setOpen] = useState<NodeContent | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:7341/ws')
    ws.onopen = () => ws.send(JSON.stringify({ type: 'tree' }))
    ws.onmessage = event => {
      const message = JSON.parse(String(event.data)) as { type: string; tree?: TreeNode; edges?: TreeEdge[] }
      if (message.type === 'tree' && message.tree !== undefined) {
        setTree(message.tree)
        setEdges(message.edges ?? [])
      }
    }
    return () => ws.close()
  }, [])

  const openNode = useCallback(async (id: string) => {
    setSelected(id)
    const response = await fetch(`/api/node/${encodeURIComponent(id)}`)
    setOpen(await response.json() as NodeContent)
  }, [])

  const createChild = useCallback(async () => {
    if (selected === null) return
    const title = window.prompt('新节点标题')
    if (title === null || title.trim() === '') return
    await fetch('/api/node', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ parent: selected, title: title.trim() }),
    })
  }, [selected])

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={createChild} disabled={selected === null}>+ 新建子节点{selected === null ? '（先点一个节点）' : `：${selected}`}</button>
      </div>
      <Canvas tree={tree} edges={edges} onOpen={openNode} />
      {open !== null && <ContentWindow node={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
