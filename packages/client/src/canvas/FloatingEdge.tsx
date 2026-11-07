import {
  getStraightPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";

/** 两个矩形中心的连线，与各自矩形边界的交点（边到边，不穿过节点） */
function intersection(node: InternalNode, target: InternalNode) {
  // measured 在缩放/重新测量期间可能为 0，用 width/height 兜底
  const w = (node.measured?.width ?? node.width ?? 0) / 2;
  const h = (node.measured?.height ?? node.height ?? 0) / 2;
  if (!w || !h) return null;

  const x2 = node.internals.positionAbsolute.x + w;
  const y2 = node.internals.positionAbsolute.y + h;
  const tw = (target.measured?.width ?? target.width ?? 0) / 2;
  const th = (target.measured?.height ?? target.height ?? 0) / 2;
  const x1 = target.internals.positionAbsolute.x + tw;
  const y1 = target.internals.positionAbsolute.y + th;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;

  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 };
}

export function FloatingEdge({ id, source, target, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const from = intersection(sourceNode, targetNode);
  const to = intersection(targetNode, sourceNode);
  if (!from || !to) return null;
  const [path] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y });

  return <path id={id} d={path} fill="none" style={style} />;
}
