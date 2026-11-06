import { useContext, useEffect, useMemo, useRef, useState } from "react";
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
  contentIds: Set<string>;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const SCRUB_SPEED = 400;

export function Canvas({ nodes, edges, signature, workspace }: Props) {
  const actions = useContext(CanvasContext)!;
  useFitView(signature);
  const { fitView, zoomTo, getViewport } = useReactFlow();
  const [space, setSpace] = useState(false);
  const [scrub, setScrub] = useState(false);
  const scrubStart = useRef<{ x: number; zoom: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) setScrub(true);
        else setSpace(true);
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
      if (e.code === "Space" || e.key === "Control" || e.key === "Meta") {
        setSpace(false);
        setScrub(false);
        scrubStart.current = null;
      }
    };
    const blur = () => {
      setSpace(false);
      setScrub(false);
      scrubStart.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [fitView, zoomTo]);

  useEffect(() => {
    if (!scrub) return;
    const move = (e: MouseEvent) => {
      if (!scrubStart.current) {
        scrubStart.current = { x: e.clientX, zoom: getViewport().zoom };
        return;
      }
      const dx = e.clientX - scrubStart.current.x;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scrubStart.current.zoom * Math.exp(dx / SCRUB_SPEED)));
      zoomTo(next, { duration: 0 });
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [scrub, getViewport, zoomTo]);

  const decorated = useMemo(
    () => nodes.map((n) => (n.type === "content" ? { ...n, data: { ...n.data, workspace } } : n)),
    [nodes, workspace],
  );

  const className = `canvas${scrub ? " scrubbing" : space ? " grabbing" : ""}`;

  return (
    <div className={className}>
      <ReactFlow
        nodes={decorated}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitView
        panOnDrag={scrub ? false : space ? true : [1, 2]}
        panOnScroll
        panOnScrollSpeed={0.8}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
      >
        <Background gap={24} size={1} color="#e8edf3" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
