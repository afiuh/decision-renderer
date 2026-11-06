import { useCallback, useEffect, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { ContentWindow } from './window/ContentWindow'
import type { NodeContent, TreeEdge, TreeNode } from '../../shared/types'

export function App() {
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [edges, setEdges] = useState<readonly TreeEdge[]>([])
  const [open, setOpen] = useState<NodeContent | null>(null)

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
    const response = await fetch(`/api/node/${encodeURIComponent(id)}`)
    setOpen(await response.json() as NodeContent)
  }, [])

  return (
    <div className="app">
      <Canvas tree={tree} edges={edges} onOpen={openNode} />
      {open !== null && <ContentWindow node={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
