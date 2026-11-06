import { useCallback } from 'react'
import type { Node } from '@xyflow/react'

/** 内容节点：parentId 跟随原节点。 */
export function useContent(workspace: string, setNodes: React.Dispatch<React.SetStateAction<Node[]>>) {
  const openContent = useCallback(async (id: string) => {
    const response = await fetch(`/api/node/${encodeURIComponent(id)}?workspace=${encodeURIComponent(workspace)}`)
    const node = await response.json() as { id: string; title: string; path: string; markdown: string }
    setNodes(prev => {
      const filtered = prev.filter(item => item.id !== `content-${id}`)
      const offset = filtered.filter(item => item.type === 'content').length
      return [...filtered, {
        id: `content-${id}`,
        type: 'content',
        parentId: id,
        position: { x: 220 + offset * 40, y: -60 + offset * 40 },
        width: 520,
        height: 420,
        data: { node, workspace, onClose: () => setNodes(list => list.filter(item => item.id !== `content-${id}`)) },
        style: { width: 520, height: 420 },
      }]
    })
  }, [workspace, setNodes])

  return { openContent }
}
