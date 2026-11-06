import { createContext } from "react";

export interface DragHandlers {
  onPointerDown: (event: React.PointerEvent, id: string) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
}

export interface CanvasActions {
  drag: DragHandlers;
  toggle: (id: string) => void;
  open: (id: string) => void;
  close: () => void;
  measure: (id: string, size: { width: number; height: number }) => void;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
}

export const CanvasContext = createContext<CanvasActions | null>(null);
