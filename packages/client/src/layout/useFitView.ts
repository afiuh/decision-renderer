import { useCallback, useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";

/** 树结构变化后 fit 一次；用户手动缩放后不打断 */
export function useFitView(signature: string) {
  const { fitView } = useReactFlow();
  const first = useRef(true);

  const fit = useCallback(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, maxZoom: 1, duration: first.current ? 0 : 200 });
      first.current = false;
    });
  }, [fitView]);

  useEffect(() => {
    fit();
  }, [signature, fit]);

  return fit;
}
