import type { FastifyInstance } from "fastify";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseTree } from "./parse.ts";
import { createNode, deleteNode, readNode, renameNode, writeNode } from "./write.ts";
import { findWorkspace, loadWorkspaces } from "./workspaces.ts";

export async function registerApi(app: FastifyInstance, projectRoot: string) {
  const workspaces = await loadWorkspaces(projectRoot);

  const wsOf = (name?: string) => findWorkspace(workspaces, name);

  app.get("/api/workspaces", async () => workspaces.map((w) => ({ name: w.name })));

  app.get("/api/tree", async (req, reply) => {
    try {
      const { ws } = req.query as { ws?: string };
      const w = wsOf(ws);
      return { workspace: w.name, tree: await parseTree(w.root) };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.get("/api/node/*", async (req, reply) => {
    try {
      const id = String((req.params as Record<string, string>)["*"]);
      const { ws } = req.query as { ws?: string };
      return await readNode(wsOf(ws).root, id);
    } catch (err) {
      reply.code(404);
      return { error: message(err) };
    }
  });

  app.post("/api/node/*", async (req, reply) => {
    try {
      const id = String((req.params as Record<string, string>)["*"]);
      const { markdown, ws } = req.body as { markdown: string; ws?: string };
      await writeNode(wsOf(ws).root, id, markdown);
      return { ok: true };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.post("/api/node", async (req, reply) => {
    try {
      const { parent, title, ws } = req.body as { parent: string; title: string; ws?: string };
      const id = await createNode(wsOf(ws).root, parent, title);
      return { ok: true, id };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.patch("/api/node/*", async (req, reply) => {
    try {
      const id = String((req.params as Record<string, string>)["*"]);
      const { name, ws } = req.body as { name: string; ws?: string };
      const nextId = await renameNode(wsOf(ws).root, id, name);
      return { ok: true, id: nextId };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.delete("/api/node/*", async (req, reply) => {
    try {
      const id = String((req.params as Record<string, string>)["*"]);
      const { ws } = req.query as { ws?: string };
      await deleteNode(wsOf(ws).root, id);
      return { ok: true };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.get("/api/search", async (req, reply) => {
    try {
      const { q, ws } = req.query as { q?: string; ws?: string };
      if (!q || !q.trim()) return { hits: [] };
      const w = wsOf(ws);
      return { hits: await search(w.root, q.trim()) };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });
}

async function search(root: string, q: string) {
  const needle = q.toLowerCase();
  const hits: { id: string; title: string; snippet: string }[] = [];

  async function walk(dir: string, rel: string) {
    if (hits.length >= 30) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (hits.length >= 30) return;
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const abs = path.join(dir, e.name);
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) {
        await walk(abs, r);
      } else if (e.name.endsWith(".md")) {
        const md = await readFile(abs, "utf8");
        const i = md.toLowerCase().indexOf(needle);
        if (i < 0) continue;
        const start = Math.max(0, i - 60);
        hits.push({
          id: r.slice(0, -3),
          title: md.match(/^#\s+(.+)$/m)?.[1].trim() ?? e.name.slice(0, -3),
          snippet: md.slice(start, i + 90).replace(/\s+/g, " ").trim(),
        });
      }
    }
  }

  await walk(root, "");
  return hits;
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
