import { useEffect } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'

export function useFitView(flowRef: React.RefObject<ReactFlowInstance | null>, expanded: ReadonlySet<string>, workspace: string): void {
  useEffect(() => {
    const timer = setTimeout(() => flowRef.current?.fitView({ padding: 0.3, maxZoom: 1, minZoom: 0.1 }), 300)
    return () => clearTimeout(timer)
  }, [flowRef, expanded, workspace])
}
