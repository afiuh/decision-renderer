import { BaseEdge, getBezierPath, useInternalNode, type EdgeProps } from '@xyflow/react'
import { getEdgeParams } from './floatingEdge'

/** 边自动连到两个节点边界的交点（不固定 handle）。 */
export function FloatingEdge({ id, source, target, style }: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (sourceNode === undefined || targetNode === undefined) return null
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode)
  const [path] = getBezierPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, sourcePosition: sourcePos, targetPosition: targetPos })
  return <BaseEdge id={id} path={path} style={style} />
}
