import { useCallback, useEffect, useRef } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";

/**
 * 只在"结构真的变了"（新建 / 删除节点）时 fit。
 * 展开、折叠、拖动、开关内容节点都不动视口。
 * skipFirst：从 localStorage 恢复了视口时，首次不 fit。
 */
export function useFitView(signature: string, skipFirst = false) {
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const lastSignature = useRef<string | null>(null);
  const first = useRef(true);

  const fit = useCallback(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.15, maxZoom: 1, minZoom: 0.3, duration: 200 });
    });
  }, [fitView]);

  useEffect(() => {
    if (!initialized) return;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    if (first.current) {
      first.current = false;
      if (skipFirst) return;
    }
    fit();
  }, [signature, initialized, fit, skipFirst]);

  return fit;
}
