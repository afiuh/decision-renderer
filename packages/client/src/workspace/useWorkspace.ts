import { useEffect, useState } from 'react'
import type { TreeEdge, TreeNode } from '../../../shared/types'

export function useWorkspace() {
  const [workspace, setWorkspace] = useState('dshiunx')
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; root: string }>>([])
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [edges, setEdges] = useState<readonly TreeEdge[]>([])

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

  return { workspace, setWorkspace, workspaces, tree, edges }
}
