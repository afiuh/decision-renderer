import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { TreeNode, TreeEdge, NodeContent } from '../../shared/types.ts'

/** 决策网络根目录（可被环境变量覆盖）。 */
export const ROOT = process.env.DECISIONS_ROOT ?? '/mnt/data/AI自由工作区/dshiunx/decisions'

/** 从 Markdown 正文提取标题（第一个 `# `）。 */
function titleOf(markdown: string, fallback: string): string {
  const line = markdown.split('\n').find(item => item.startsWith('# '))
  return line === undefined ? fallback : line.slice(2).trim()
}

/** 从正文提取状态：✅ done / ❌ blocked / ⏳ partial / 待确认 todo。 */
function statusOf(markdown: string): TreeNode['status'] {
  if (markdown.includes('❌')) return 'blocked'
  if (markdown.includes('⏳')) return 'partial'
  if (markdown.includes('✅')) return 'done'
  if (markdown.includes('待确认') || markdown.includes('待定')) return 'todo'
  return 'unknown'
}

/** 递归解析目录 → 节点树 + 边。 */
export async function parseTree(dir: string = ROOT): Promise<{ tree: TreeNode; edges: TreeEdge[] }> {
  const edges: TreeEdge[] = []

  const walk = async (folder: string, baseName: string): Promise<TreeNode[]> => {
    const entries = await readdir(folder, { withFileTypes: true })
    const nodes: TreeNode[] = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const file = join(folder, entry.name)
      const name = entry.name.slice(0, -3)
      const markdown = await readFile(file, 'utf8')
      const id = relative(ROOT, file).replace(/\.md$/, '')
      const childFolder = join(folder, `${name}-子节点`)
      let children: TreeNode[] = []
      try {
        const info = await stat(childFolder)
        if (info.isDirectory()) children = await walk(childFolder, name)
      } catch { /* 没有子节点 */ }
      const node: TreeNode = {
        id,
        title: titleOf(markdown, baseName === '' ? name : baseName),
        path: file,
        status: statusOf(markdown),
        children,
      }
      nodes.push(node)
      for (const child of children) edges.push({ from: id, to: child.id })
    }
    return nodes
  }

  const roots = await walk(dir, '')
  const tree: TreeNode = {
    id: '__root__',
    title: '决策网络',
    path: dir,
    status: 'unknown',
    children: roots,
  }
  for (const root of roots) edges.push({ from: '__root__', to: root.id })
  return { tree, edges }
}

/** 读单个节点内容。 */
export async function readNode(id: string): Promise<NodeContent> {
  const path = join(ROOT, `${id}.md`)
  const markdown = await readFile(path, 'utf8')
  return { id, title: titleOf(markdown, id), path, markdown }
}

/** 写节点（覆盖文件）。 */
export async function writeNode(id: string, markdown: string): Promise<void> {
  await writeFile(join(ROOT, `${id}.md`), markdown, 'utf8')
}
