import { Handle, Position, type NodeProps } from '@xyflow/react'

const STATUS_LABEL: Record<string, string> = {
  done: '✅', partial: '⏳', todo: '❓', blocked: '❌', unknown: '·',
}

export function NodeCard({ data }: NodeProps) {
  const title = String(data.title ?? '')
  const status = String(data.status ?? 'unknown')
  const dirty = Boolean(data.dirty)
  const hasChildren = Boolean(data.hasChildren)
  const expanded = Boolean(data.expanded)
  const toggle = data.onToggle as (() => void) | undefined
  return (
    <div className={`node-card node-${status}${dirty ? ' node-dirty' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-row">
        <div className="node-title">{title}</div>
        {hasChildren && (
          <button className="node-toggle" onClick={event => { event.stopPropagation(); toggle?.() }}>
            {expanded ? '−' : '+'}
          </button>
        )}
      </div>
      <div className="node-status">{STATUS_LABEL[status] ?? '·'}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
