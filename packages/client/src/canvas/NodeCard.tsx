import { useContext, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TreeNode } from "@dr/shared";
import { CanvasContext } from "../drag/DragContext.ts";

interface CardData {
  node: TreeNode;
  expanded: boolean;
  selected: boolean;
}

export function NodeCard({ id, data }: NodeProps) {
  const { node, expanded, selected } = data as unknown as CardData;
  const actions = useContext(CanvasContext)!;
  const ref = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = el.getBoundingClientRect(); const box = { width: r.width, height: r.height };
      actions.measure(id, { width: box.width + 2, height: box.height + 2 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, actions]);

  return (
    <div
      ref={ref}
      className={`card${expanded ? " open" : ""}${selected ? " selected" : ""} status-${node.status || "none"}`}
      onPointerDown={(e) => {
        moved.current = false;
        actions.drag.onPointerDown(e, id);
      }}
      onPointerMove={(e) => {
        moved.current = true;
        actions.drag.onPointerMove(e);
      }}
      onPointerUp={(e) => actions.drag.onPointerUp(e)}
      onClick={() => {
        if (!moved.current) actions.open(id);
      }}
    >
      <Handle type="target" position={Position.Top} className="rf-handle" />
      <Handle type="source" position={Position.Bottom} className="rf-handle" />
      <span className="dot" />
      <span className="card-title">{node.title}</span>
      {node.children.length > 0 && (
        <button
          className="toggle nodrag"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            actions.toggle(id);
          }}
          title={expanded ? "折叠" : "展开"}
        >
          {expanded ? "−" : "+"}
        </button>
      )}
    </div>
  );
}
