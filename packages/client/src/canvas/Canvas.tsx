import { useCallback, useContext, useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
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
}

export function Canvas({ nodes, edges, signature, workspace }: Props) {
  const actions = useContext(CanvasContext)!;
  useFitView(signature);

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
