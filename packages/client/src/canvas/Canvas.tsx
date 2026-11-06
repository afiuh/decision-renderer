import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import type { TreeNode } from "@dr/shared";
import { CanvasContext } from "../drag/DragContext.ts";
import { useFitView } from "../layout/useFitView.ts";
import { ContentNode } from "./ContentNode.tsx";
import { FloatingEdge } from "./FloatingEdge.tsx";
import { NodeCard } from "./NodeCard.tsx";

const nodeTypes: NodeTypes = { card: NodeCard, content: ContentNode };
const edgeTypes = { floating: FloatingEdge };

interface Props {
  nodes: Node[];
  edges: ReturnType<typeof import("../layout/useNodes.ts").useEdges>;
  signature: string;
  workspace: string;
  contentId: string | null;
}

export function Canvas({ nodes, edges, signature, workspace, contentId }: Props) {
  const actions = useContext(CanvasContext)!;
  useFitView(signature);
  const { setCenter } = useReactFlow();
  const lastContent = useRef<string | null>(null);

  useEffect(() => {
    if (!contentId) {
      lastContent.current = null;
      return;
    }
    if (lastContent.current === contentId) return;
    lastContent.current = contentId;
    const key = "content:" + contentId;
    const node = nodes.find((n) => n.id === key);
    if (!node) return;
    const style = (node.style ?? {}) as { width?: number; height?: number };
    const w = style.width ?? 560;
    const h = style.height ?? 440;
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 0.8, duration: 300 });
  }, [contentId, nodes, setCenter]);

  const decorated = useMemo(
    () =>
      nodes.map((n) =>
        n.type === "content" ? { ...n, data: { ...n.data, workspace } } : n,
      ),
    [nodes, workspace],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "card") actions.open(node.id);
    },
    [actions],
  );

  return (
    <ReactFlow
      nodes={decorated}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
      minZoom={0.05}
      maxZoom={2}
      fitView
    >
      <Background gap={24} size={1} color="#e8edf3" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
