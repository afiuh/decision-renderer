import { useCallback, useEffect, useRef } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";

/**
 * 只在"结构真的变了"（切换工作区 / 新建 / 删除节点）时 fit。
 * 展开、折叠、拖动、开关内容节点都不动视口。
 */
export function useFitView(signature: string) {
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const lastSignature = useRef<string | null>(null);

  const fit = useCallback(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.15, maxZoom: 1, duration: 200 });
    });
  }, [fitView]);

  useEffect(() => {
    if (!initialized) return;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    fit();
  }, [signature, initialized, fit]);

  return fit;
}
