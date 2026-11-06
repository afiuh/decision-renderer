import { useCallback, useState } from 'react'
import { useWorkspace } from './workspace/useWorkspace'
import { Canvas } from './canvas/Canvas'

export function App() {
  const { workspace, setWorkspace, workspaces, tree, edges } = useWorkspace()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Array<{ id: string; title: string; snippet: string }>>([])

  const search = useCallback(async (value: string) => {
    setQuery(value)
    if (value.trim() === '') { setHits([]); return }
    const response = await fetch(`/api/search?q=${encodeURIComponent(value)}&workspace=${encodeURIComponent(workspace)}`)
    setHits(await response.json() as Array<{ id: string; title: string; snippet: string }>)
  }, [workspace])

  return (
    <div className="app">
      <div className="toolbar">
        <select className="workspace" value={workspace} onChange={event => setWorkspace(event.target.value)}>
          {workspaces.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
        </select>
        <input className="search" value={query} onChange={event => void search(event.target.value)} placeholder="搜索节点…" />
        {hits.length > 0 && (
          <ul className="hits">
            {hits.map(hit => (<li key={hit.id} onClick={() => { setHits([]); setQuery('') }}><strong>{hit.title}</strong><span>{hit.snippet.slice(0, 60)}</span></li>))}
          </ul>
        )}
      </div>
      <Canvas tree={tree} edges={edges} workspace={workspace} />
    </div>
  )
}
