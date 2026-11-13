import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import type { FSWatcher } from "chokidar";
import type { TreeNode } from "@dr/shared";
import { registerApi } from "./api.ts";
import { parseTree } from "./parse.ts";
import { ensureDefaultProject } from "./projects.ts";
import { loadWorkspaces } from "./workspaces.ts";
import { watchWorkspace } from "./watch.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.DR_ROOT ? path.resolve(process.env.DR_ROOT) : path.resolve(here, "../../..");
const port = Number(process.env.DR_PORT ?? 7341);

const app = Fastify({ logger: false });
await app.register(fastifyCors, { origin: true });

const trees = new Map<string, TreeNode[]>();
const wss = new WebSocketServer({ server: app.server, path: "/ws" });
const sockets = new Set<import("ws").WebSocket>();
let watchers: FSWatcher[] = [];

// 无页面连接时自动退出：最后一个 WebSocket 断开后，宽限 DR_IDLE_GRACE_MS 毫秒仍无连接则退出。
// 刷新页面会短暂断开再连，宽限期避免误杀。
const IDLE_GRACE_MS = Number(process.env.DR_IDLE_GRACE_MS ?? 45000);
let idleTimer: NodeJS.Timeout | null = null;

function cancelIdleShutdown() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleShutdown() {
  if (sockets.size > 0 || idleTimer) return;
  idleTimer = setTimeout(async () => {
    idleTimer = null;
    if (sockets.size > 0) return;
    console.log(`[idle] 无页面连接超过 ${IDLE_GRACE_MS}ms，自动退出`);
    try {
      for (const w of watchers) await w.close();
    } catch {}
    process.exit(0);
  }, IDLE_GRACE_MS);
}

function broadcast(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const s of sockets) if (s.readyState === 1) s.send(data);
}

async function refresh(root: string) {
  const tree = await parseTree(root);
  trees.set(root, tree);
  broadcast({ type: "tree", workspace: root, tree });
}

async function syncWatchers() {
  for (const w of watchers) await w.close();
  watchers = [];
  const list = await loadWorkspaces(projectRoot);
  for (const w of list) {
    if (!existsSync(w.root)) continue;
    await refresh(w.root).catch(() => undefined);
    watchers.push(watchWorkspace(w.root, () => refresh(w.root).catch((err) => console.error("[watch]", err))));
  }
  broadcast({ type: "projects", workspaces: list });
}

await ensureDefaultProject(projectRoot);
await registerApi(app, projectRoot, () => void syncWatchers());

const dist = path.resolve(projectRoot, "packages/client/dist");
if (existsSync(dist)) await app.register(fastifyStatic, { root: dist });

await syncWatchers();

wss.on("connection", (socket) => {
  cancelIdleShutdown();
  sockets.add(socket);
  socket.on("close", () => {
    sockets.delete(socket);
    if (sockets.size === 0) scheduleIdleShutdown();
  });
  socket.send(JSON.stringify({ type: "hello", trees: Object.fromEntries(trees) }));
});

await app.listen({ port, host: "127.0.0.1" });
console.log(`decision-renderer server → http://127.0.0.1:${port}`);
