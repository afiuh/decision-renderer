export interface SavedCanvas {
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
    return raw ? (JSON.parse(raw) as SavedCanvas) : {};
  } catch {
    return {};
  }
}

export function saveCanvas(project: string, state: SavedCanvas) {
  try {
    localStorage.setItem(KEY(project), JSON.stringify(state));
  } catch {
    /* 配额满了就放弃：视图状态可丢 */
  }
}
