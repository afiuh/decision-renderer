import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type Layout = Record<string, { x: number; y: number }>

const fileOf = (root: string): string => join(root, '.layout.json')

export async function readLayout(root: string): Promise<Layout> {
  try {
    return JSON.parse(await readFile(fileOf(root), 'utf8')) as Layout
  } catch {
    return {}
  }
}

export async function writeLayout(root: string, layout: Layout): Promise<void> {
  await writeFile(fileOf(root), JSON.stringify(layout, null, 2), 'utf8')
}
