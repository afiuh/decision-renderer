import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { useRoutedEdgePath } from 'reactflow-edge-routing'

/** 避障正交边（绕开节点）。 */
export function RoutedEdge({ id, sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
  const [path, labelX, labelY] = useRoutedEdgePath({ id, sourceX, sourceY, targetX, targetY })
  return <BaseEdge id={id} path={path} labelX={labelX} labelY={labelY} style={style} />
}
