import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ROOT } from './parse.ts'

const run = promisify(execFile)

/** 仓库根（ROOT 的上级，找 .git）。 */
const repoOf = (): string => ROOT.replace(/\/decisions$/, '')

/** 返回 decisions/ 下未提交变化的文件（相对 ROOT 的路径，去 .md）。 */
export async function dirtyFiles(): Promise<Set<string>> {
  try {
    const { stdout } = await run('git', ['-C', repoOf(), '-c', 'core.quotepath=false', 'status', '--porcelain', '--', 'decisions'], { maxBuffer: 4 * 1024 * 1024 })
    const result = new Set<string>()
    for (const line of stdout.split('\n')) {
      const path = line.slice(3).trim()
      if (!path.endsWith('.md')) continue
      const relative = path.replace(/^decisions\//, '').replace(/\.md$/, '')
      result.add(relative)
    }
    return result
  } catch {
    return new Set()
  }
}
