import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
export type Layout = Record<string, { x: number; y: number }>
export async function readLayout(root: string): Promise<Layout> {
  try { return JSON.parse(await readFile(join(root, '.layout.json'), 'utf8')) as Layout } catch { return {} }
}
export async function writeLayout(root: string, layout: Layout): Promise<void> {
  await writeFile(join(root, '.layout.json'), JSON.stringify(layout, null, 2), 'utf8')
}
