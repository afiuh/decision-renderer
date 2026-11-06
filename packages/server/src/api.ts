import type { FastifyInstance } from "fastify";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseTree } from "./parse.ts";
import { addProject, browse, createProject, getSession, listProjects, makeDir, removeProject, setSession } from "./projects.ts";
import { createNode, deleteNode, readNode, renameNode, writeNode } from "./write.ts";
import { findWorkspace, loadWorkspaces } from "./workspaces.ts";

export async function registerApi(app: FastifyInstance, projectRoot: string, onChange?: () => void) {
  const wsOf = async (key?: string) => findWorkspace(await loadWorkspaces(projectRoot), key);

  app.get("/api/projects", async () => listProjects());

  app.post("/api/projects", async (req, reply) => {
    try {
      const { path: dir } = req.body as { path: string };
      const rec = await addProject(dir);
      onChange?.();
      return rec;
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.delete("/api/projects", async (req, reply) => {
    try {
      const { path: dir } = req.query as { path: string };
      await removeProject(dir);
      onChange?.();
      return { ok: true };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.post("/api/projects/create", async (req, reply) => {
    try {
      const { parent, name } = req.body as { parent: string; name: string };
      const dir = await createProject(parent, name);
      onChange?.();
      return { ok: true, path: dir };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.get("/api/session", async () => getSession());

  app.put("/api/session", async (req, reply) => {
    try {
      await setSession(req.body as { open: string[]; active: number });
      return { ok: true };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.get("/api/fs", async (req, reply) => {
    try {
      const { path: dir } = req.query as { path?: string };
      return await browse(dir);
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.post("/api/fs/mkdir", async (req, reply) => {
    try {
      const { parent, name } = req.body as { parent: string; name: string };
      return { path: await makeDir(parent, name) };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.get("/api/workspaces", async () => (await loadWorkspaces(projectRoot)).map((w) => ({ name: w.name, root: w.root })));

  app.get("/api/tree", async (req, reply) => {
    try {
      const { ws } = req.query as { ws?: string };
      const w = await wsOf(ws);
      return { workspace: w.root, tree: await parseTree(w.root) };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.get("/api/node/*", async (req, reply) => {
    try {
      const id = String((req.params as Record<string, string>)["*"]);
      const { ws } = req.query as { ws?: string };
      return await readNode((await wsOf(ws)).root, id);
    } catch (err) {
      reply.code(404);
      return { error: message(err) };
    }
  });

  app.post("/api/node/*", async (req, reply) => {
    try {
      const id = String((req.params as Record<string, string>)["*"]);
      const { markdown } = req.body as { markdown: string };
      const { ws } = req.query as { ws?: string };
      await writeNode((await wsOf(ws)).root, id, markdown);
      return { ok: true };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.post("/api/node", async (req, reply) => {
    try {
      const { parent, title } = req.body as { parent: string; title: string };
      const { ws } = req.query as { ws?: string };
      const id = await createNode((await wsOf(ws)).root, parent, title);
      return { ok: true, id };
    } catch (err) {
      reply.code(400);
      return { error: message(err) };
    }
  });

  app.patch("/api/node/*", async (req, reply) => {
    try {
      const id = String((req.params as Record<string, string>)["*"]);
      const { name } = req.body as { name: string };
      const { ws } = req.query as { ws?: string };
      const nextId = await renameNode((await wsOf(ws)).root, id, name);
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
      await deleteNode((await wsOf(ws)).root, id);
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
      const w = await wsOf(ws);
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
