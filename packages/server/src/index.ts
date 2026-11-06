import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import type { TreeNode } from "@dr/shared";
import { registerApi } from "./api.ts";
import { parseTree } from "./parse.ts";
import { loadWorkspaces } from "./workspaces.ts";
import { watchWorkspace } from "./watch.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.DR_ROOT
  ? path.resolve(process.env.DR_ROOT)
  : path.resolve(here, "../../..");
const port = Number(process.env.DR_PORT ?? 7341);

const app = Fastify({ logger: false });
await app.register(fastifyCors, { origin: true });
await registerApi(app, projectRoot);

const dist = path.resolve(projectRoot, "packages/client/dist");
if (existsSync(dist)) {
  await app.register(fastifyStatic, { root: dist });
}

const workspaces = await loadWorkspaces(projectRoot);
const trees = new Map<string, TreeNode[]>();

const wss = new WebSocketServer({ server: app.server, path: "/ws" });
const sockets = new Set<import("ws").WebSocket>();

function broadcast(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const s of sockets) {
    if (s.readyState === 1) s.send(data);
  }
}

async function refresh(name: string, root: string) {
  const tree = await parseTree(root);
  trees.set(name, tree);
  broadcast({ type: "tree", workspace: name, tree });
}

for (const w of workspaces) {
  await refresh(w.name, w.root);
  watchWorkspace(w.root, () => {
    refresh(w.name, w.root).catch((err) => console.error("[watch]", err));
  });
}

wss.on("connection", (socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.send(
    JSON.stringify({
      type: "hello",
      workspaces: workspaces.map((w) => w.name),
      trees: Object.fromEntries(trees),
    }),
  );
});

await app.listen({ port, host: "127.0.0.1" });
console.log(`decision-renderer server → http://127.0.0.1:${port}`);
