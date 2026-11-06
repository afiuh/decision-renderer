import { Handle, Position, type NodeProps } from '@xyflow/react'

const STATUS: Record<string, string> = { done: '✅', partial: '⏳', todo: '❓', blocked: '❌', unknown: '·' }

export function NodeCard({ data }: NodeProps) {
  const status = String(data.status ?? 'unknown')
  const hasChildren = Boolean(data.hasChildren)
  const expanded = Boolean(data.expanded)
  const toggle = data.onToggle as (() => void) | undefined
  return (
    <div className={`node-card node-${status}${data.dirty ? ' node-dirty' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-row">
        <div className="node-title">{String(data.title ?? '')}</div>
        {hasChildren && <button className="node-toggle" onClick={event => { event.stopPropagation(); toggle?.() }}>{expanded ? '−' : '+'}</button>}
      </div>
      <div className="node-status">{STATUS[status] ?? '·'}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
