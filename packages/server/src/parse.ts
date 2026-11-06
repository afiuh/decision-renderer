import { readdir, readFile, writeFile, stat, mkdir, rm, rename } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import type { TreeNode, TreeEdge, NodeContent } from '../../shared/types.ts'

export const ROOT = process.env.DECISIONS_ROOT ?? '/mnt/data/AI自由工作区/dshiunx/decisions'

const titleOf = (md: string, fallback: string): string => md.split('\n').find(line => line.startsWith('# '))?.slice(2).trim() ?? fallback
const statusOf = (md: string): TreeNode['status'] =>
  md.includes('❌') ? 'blocked' : md.includes('⏳') ? 'partial' : md.includes('✅') ? 'done' : md.includes('待确认') || md.includes('待定') ? 'todo' : 'unknown'

export async function parseTree(dir: string = ROOT): Promise<{ tree: TreeNode; edges: TreeEdge[] }> {
  const edges: TreeEdge[] = []
  const walk = async (folder: string): Promise<TreeNode[]> => {
    const entries = await readdir(folder, { withFileTypes: true })
    const nodes: TreeNode[] = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const name = entry.name.slice(0, -3)
      const file = join(folder, entry.name)
      const markdown = await readFile(file, 'utf8')
      const id = relative(dir, file).replace(/\.md$/, '')
      let children: TreeNode[] = []
      try { if ((await stat(join(folder, `${name}-子节点`))).isDirectory()) children = await walk(join(folder, `${name}-子节点`)) } catch { /* 叶子 */ }
      nodes.push({ id, title: titleOf(markdown, name), path: file, status: statusOf(markdown), children })
      for (const child of children) edges.push({ from: id, to: child.id })
    }
    return nodes
  }
  const roots = await walk(dir)
  const tree: TreeNode = { id: '__root__', title: '决策网络', path: dir, status: 'unknown', children: roots }
  for (const root of roots) edges.push({ from: '__root__', to: root.id })
  return { tree, edges }
}

export async function readNode(id: string, root: string = ROOT): Promise<NodeContent> {
  const markdown = await readFile(join(root, `${id}.md`), 'utf8')
  return { id, title: titleOf(markdown, id), path: join(root, `${id}.md`), markdown }
}

export async function writeNode(id: string, markdown: string, root: string = ROOT): Promise<void> {
  await writeFile(join(root, `${id}.md`), markdown, 'utf8')
}

export async function createNode(parent: string, title: string, root: string = ROOT): Promise<string> {
  const folder = join(dirname(join(root, `${parent}.md`)), `${parent.split('/').pop()}-子节点`)
  await mkdir(folder, { recursive: true })
  const file = join(folder, `${title}.md`)
  await writeFile(file, `# ${title}\n\n## 目的\n\n（待写）\n\n## 边界\n\n（待写）\n\n## 验证\n\n（待写）\n`, 'utf8')
  return relative(root, file).replace(/\.md$/, '')
}

export async function deleteNode(id: string, root: string = ROOT): Promise<void> {
  await rm(join(root, `${id}.md`), { force: true })
  await rm(join(root, `${id}-子节点`), { recursive: true, force: true })
}

export async function renameNode(id: string, title: string, root: string = ROOT): Promise<string> {
  const parts = id.split('/')
  const old = parts.pop() ?? id
  const next = parts.length === 0 ? title : `${parts.join('/')}/${title}`
  await rename(join(root, `${id}.md`), join(root, `${next}.md`))
  try { await stat(join(root, `${id}-子节点`)); await rename(join(root, `${id}-子节点`), join(root, `${next}-子节点`)) } catch { /* 无子节点 */ }
  return next
}

export async function searchNodes(query: string, root: string = ROOT): Promise<Array<{ id: string; title: string; snippet: string }>> {
  const hits: Array<{ id: string; title: string; snippet: string }> = []
  const walk = async (folder: string): Promise<void> => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const full = join(folder, entry.name)
      if (entry.isDirectory()) { await walk(full); continue }
      if (!entry.name.endsWith('.md')) continue
      const markdown = await readFile(full, 'utf8')
      const index = markdown.toLowerCase().indexOf(query.toLowerCase())
      if (index < 0) continue
      hits.push({ id: relative(root, full).replace(/\.md$/, ''), title: titleOf(markdown, entry.name), snippet: markdown.slice(Math.max(0, index - 40), index + 80).replace(/\s+/g, ' ') })
    }
  }
  await walk(root)
  return hits.slice(0, 50)
}
