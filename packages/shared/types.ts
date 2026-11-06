/** 决策网络节点（画布上的卡片）。 */
export interface TreeNode {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly status: 'done' | 'partial' | 'todo' | 'blocked' | 'unknown'
  readonly children: readonly TreeNode[]
}

/** 一条父子边。 */
export interface TreeEdge {
  readonly from: string
  readonly to: string
}

/** 节点内容。 */
export interface NodeContent {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly markdown: string
}

/** WebSocket 消息。 */
export type ServerMessage =
  | { type: 'tree'; tree: TreeNode; edges: readonly TreeEdge[] }
  | { type: 'node'; node: NodeContent }

export type ClientMessage =
  | { type: 'read'; id: string }
