import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
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

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function Canvas({ nodes, edges, signature, workspace, contentId }: Props) {
  const actions = useContext(CanvasContext)!;
  useFitView(signature);
  const { setCenter, fitView, zoomTo } = useReactFlow();
  const lastContent = useRef<string | null>(null);
  const [space, setSpace] = useState(false);

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

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpace(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        fitView({ padding: 0.15, maxZoom: 1 });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "1") {
        e.preventDefault();
        zoomTo(1, { duration: 200 });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    const blur = () => setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [fitView, zoomTo]);

  const decorated = useMemo(
    () => nodes.map((n) => (n.type === "content" ? { ...n, data: { ...n.data, workspace } } : n)),
    [nodes, workspace],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "card") actions.open(node.id);
    },
    [actions],
  );

  return (
    <div className={`canvas${space ? " grabbing" : ""}`}>
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
        maxZoom={8}
        fitView
        panOnDrag={space ? true : [1, 2]}
        panOnScroll
        panOnScrollSpeed={0.8}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        zoomActivationKeyCode="Alt"
        selectionOnDrag={false}
      >
        <Background gap={24} size={1} color="#e8edf3" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
