export interface TreeNode {
  /** 相对工作区根的路径，不含 .md；也是唯一 id */
  id: string;
  title: string;
  /** 相对路径，含 .md */
  path: string;
  status: "done" | "doing" | "todo" | "";
  hasChildren: boolean;
  children: TreeNode[];
}

export interface NodeContent {
  id: string;
  path: string;
  title: string;
  markdown: string;
  mtime: number;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
}

export interface Workspace {
  name: string;
  root: string;
}

/** 渲染层上报给布局层的卡片尺寸 */
export interface NodeSize {
  width: number;
  height: number;
}

/** 布局输出：节点中心坐标 */
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
  radius: number;
}
