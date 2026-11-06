import { useCallback, useEffect, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import type { TreeEdge, TreeNode } from '../../shared/types'

export function App() {
  const [workspace, setWorkspace] = useState('dshiunx')
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; root: string }>>([])
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [edges, setEdges] = useState<readonly TreeEdge[]>([])

  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Array<{ id: string; title: string; snippet: string }>>([])

  useEffect(() => {
    fetch('/api/workspaces').then(response => response.json()).then(setWorkspaces).catch(() => {})
  }, [])

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:7341/ws?workspace=${encodeURIComponent(workspace)}`)
    ws.onopen = () => ws.send(JSON.stringify({ type: 'tree' }))
    ws.onmessage = event => {
      const message = JSON.parse(String(event.data)) as { type: string; tree?: TreeNode; edges?: TreeEdge[] }
      if (message.type === 'tree' && message.tree !== undefined) {
        setTree(message.tree)
        setEdges(message.edges ?? [])
      }
    }
    return () => ws.close()
  }, [workspace])

  const openNode = useCallback((id: string) => {
    setSelected(id)
  }, [])

  const search = useCallback(async (value: string) => {
    setQuery(value)
    if (value.trim() === '') { setHits([]); return }
    const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
    setHits(await response.json() as Array<{ id: string; title: string; snippet: string }>)
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
        <select className="workspace" value={workspace} onChange={event => setWorkspace(event.target.value)}>
          {workspaces.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
        </select>
        <button onClick={createChild} disabled={selected === null}>+ 新建子节点{selected === null ? '（先点一个节点）' : `：${selected}`}</button>
        <input className="search" value={query} onChange={event => void search(event.target.value)} placeholder="搜索节点…" />
        {hits.length > 0 && (
          <ul className="hits">
            {hits.map(hit => (
              <li key={hit.id} onClick={() => { openNode(hit.id); setHits([]); setQuery('') }}>
                <strong>{hit.title}</strong>
                <span>{hit.snippet.slice(0, 60)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Canvas tree={tree} edges={edges} onOpen={openNode} workspace={workspace} />
    </div>
  )
}
