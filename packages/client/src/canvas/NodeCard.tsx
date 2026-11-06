import { Handle, Position, type NodeProps } from '@xyflow/react'

const STATUS_LABEL: Record<string, string> = {
  done: '✅', partial: '⏳', todo: '❓', blocked: '❌', unknown: '·',
}

export function NodeCard({ data }: NodeProps) {
  const title = String(data.title ?? '')
  const status = String(data.status ?? 'unknown')
  return (
    <div className={`node-card node-${status}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-title">{title}</div>
      <div className="node-status">{STATUS_LABEL[status] ?? '·'}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
