import chokidar from 'chokidar'
import { ROOT, parseTree } from './parse.ts'

/** 监听决策网络目录，变化时回调最新树。 */
export function watchTree(onChange: (payload: Awaited<ReturnType<typeof parseTree>>) => void): void {
  const watcher = chokidar.watch(ROOT, { ignoreInitial: true, depth: 10 })
  let timer: NodeJS.Timeout | undefined
  const trigger = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => { parseTree().then(onChange) }, 200)
  }
  watcher.on('add', trigger).on('change', trigger).on('unlink', trigger)
}
