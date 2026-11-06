export const WORKSPACES: Record<string, string> = {
  dshiunx: '/mnt/data/AI自由工作区/dshiunx/decisions',
  'decision-renderer': '/mnt/data/AI自由工作区/decision-renderer',
}
export const rootOf = (name?: string): string => WORKSPACES[name ?? 'dshiunx'] ?? WORKSPACES.dshiunx
export const listWorkspaces = (): Array<{ id: string; root: string }> => Object.entries(WORKSPACES).map(([id, root]) => ({ id, root }))
