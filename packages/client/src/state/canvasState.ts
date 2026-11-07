const VERSION = 2;

export interface SavedCanvas {
  version?: number;
  expanded?: string[];
  dragged?: Record<string, number>;
  contentIds?: string[];
  contentPos?: Record<string, { x: number; y: number }>;
  viewport?: { x: number; y: number; zoom: number };
}

const KEY = (project: string) => "dr:canvas:" + project;

export function loadCanvas(project: string): SavedCanvas {
  try {
    const raw = localStorage.getItem(KEY(project));
    if (!raw) return {};
    const saved = JSON.parse(raw) as SavedCanvas;
    // 旧版本的拖拽角度/位置是按废弃的碰撞算法算出来的，会把节点挤到一侧
    if (saved.version !== VERSION) return { expanded: saved.expanded ?? [] };
    return saved;
  } catch {
    return {};
  }
}

export function saveCanvas(project: string, state: SavedCanvas) {
  try {
    localStorage.setItem(KEY(project), JSON.stringify({ ...state, version: VERSION }));
  } catch {
    /* 配额满了就放弃：视图状态可丢 */
  }
}
