import chokidar from "chokidar";

export function watchWorkspace(root: string, onChange: () => void) {
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: /(^|[\\/])(node_modules|\.git)([\\/]|$)/,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });
  let timer: NodeJS.Timeout | undefined;
  const fire = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 200);
  };
  watcher.on("add", fire).on("change", fire).on("unlink", fire).on("addDir", fire).on("unlinkDir", fire);
  return watcher;
}
