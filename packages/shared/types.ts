export interface TreeNode {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly status: 'done' | 'partial' | 'todo' | 'blocked' | 'unknown'
  readonly dirty?: boolean
  readonly children: readonly TreeNode[]
}

export interface TreeEdge { readonly from: string; readonly to: string }
export interface NodeContent { readonly id: string; readonly title: string; readonly path: string; readonly markdown: string }
