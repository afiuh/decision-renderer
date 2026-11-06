/** 工作区 = 一个决策网络根目录（多个项目可同时看）。 */
export const WORKSPACES: Record<string, string> = {
  dshiunx: '/mnt/data/AI自由工作区/dshiunx/decisions',
  'decision-renderer': '/mnt/data/AI自由工作区/decision-renderer',
}

export function rootOf(name?: string): string {
  return WORKSPACES[name ?? 'dshiunx'] ?? WORKSPACES.dshiunx
}

export function listWorkspaces(): Array<{ id: string; root: string }> {
  return Object.entries(WORKSPACES).map(([id, root]) => ({ id, root }))
}
