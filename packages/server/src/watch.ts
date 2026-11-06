import chokidar from 'chokidar'
import { parseTree, ROOT } from './parse.ts'
export function watchTree(onChange: (payload: Awaited<ReturnType<typeof parseTree>>) => void): void {
  const watcher = chokidar.watch(ROOT, { ignoreInitial: true, depth: 10 })
  let timer: NodeJS.Timeout | undefined
  const trigger = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => { parseTree().then(onChange) }, 200)
  }
  watcher.on('add', trigger).on('change', trigger).on('unlink', trigger)
}
