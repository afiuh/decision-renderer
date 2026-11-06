import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ROOT } from './parse.ts'
const run = promisify(execFile)
export async function dirtyFiles(): Promise<Set<string>> {
  try {
    const { stdout } = await run('git', ['-C', ROOT.replace(/\/decisions$/, ''), '-c', 'core.quotepath=false', 'status', '--porcelain', '--', 'decisions'], { maxBuffer: 4 * 1024 * 1024 })
    const result = new Set<string>()
    for (const line of stdout.split('\n')) {
      const path = line.slice(3).trim()
      if (!path.endsWith('.md')) continue
      result.add(path.replace(/^decisions\//, '').replace(/\.md$/, ''))
    }
    return result
  } catch { return new Set() }
}
