import { useCallback, useEffect } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";

/** 节点测量完成后 fit；结构变化（展开/折叠/内容节点开关）后重新 fit */
export function useFitView(signature: string) {
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();

  const fit = useCallback(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.15, maxZoom: 1, duration: 200 });
    });
  }, [fitView]);

  useEffect(() => {
    if (!initialized) return;
    fit();
  }, [signature, initialized, fit]);

  return fit;
}
