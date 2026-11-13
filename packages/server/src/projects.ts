import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".config", "decision-renderer");
const CONFIG_FILE = path.join(CONFIG_DIR, "projects.json");

export interface ProjectRecord {
  path: string;
  name: string;
}

export interface Session {
  open: string[];
  active: number;
}

export interface Config {
  projects: ProjectRecord[];
  session: Session;
}

const EMPTY: Config = { projects: [], session: { open: [], active: 0 } };

export async function loadConfig(): Promise<Config> {
  try {
    const raw = JSON.parse(await readFile(CONFIG_FILE, "utf8")) as Partial<Config>;
    return {
      projects: Array.isArray(raw.projects) ? raw.projects.filter((p) => p && typeof p.path === "string") : [],
      session: raw.session && Array.isArray(raw.session.open) ? raw.session : { open: [], active: 0 },
    };
  } catch {
    return { projects: [], session: { open: [], active: 0 } };
  }
}

export async function saveConfig(cfg: Config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

export async function ensureDefaultProject(projectRoot: string) {
  const cfg = await loadConfig();
  if (cfg.projects.length === 0) await addProject(projectRoot);
}

export async function listProjects() {
  const cfg = await loadConfig();
  const out: (ProjectRecord & { exists: boolean })[] = [];
  for (const p of cfg.projects) out.push({ ...p, exists: await isDir(p.path) });
  return out;
}

export async function addProject(dir: string, name?: string) {
  const abs = path.resolve(dir);
  if (!(await isDir(abs))) throw new Error("目录不存在: " + abs);
  const entries = await readdir(abs);
  if (!entries.some((n) => n.endsWith(".md"))) {
    throw new Error("这个目录里没有 .md 节点，不是决策网络目录（应选包含 决策网络.md / 核心战略.md 的那一层）");
  }
  const cfg = await loadConfig();
  const existing = cfg.projects.find((p) => p.path === abs);
  if (existing) return existing;
  const rec = { path: abs, name: name || path.basename(abs) };
  cfg.projects.push(rec);
  await saveConfig(cfg);
  return rec;
}

export async function removeProject(dir: string) {
  const abs = path.resolve(dir);
  const cfg = await loadConfig();
  cfg.projects = cfg.projects.filter((p) => p.path !== abs);
  cfg.session.open = cfg.session.open.filter((p) => p !== abs);
  cfg.session.active = Math.min(cfg.session.active, Math.max(0, cfg.session.open.length - 1));
  await saveConfig(cfg);
}

export async function createProject(parent: string, name: string) {
  if (!name.trim()) throw new Error("名称不能为空");
  if (/[\u0000-\u001f/\\:*?"<>|]/.test(name)) throw new Error("名称含非法字符");
  const abs = path.resolve(parent, name);
  if (await exists(abs)) throw new Error("目标已存在");
  await mkdir(abs, { recursive: true });
  const body = `# ${name}\n\n**父级**：无\n\n## 要做什么\n\n## 为什么要做\n\n## 怎么做\n\n## 如何验证自己做对了\n`;
  await writeFile(path.join(abs, name + ".md"), body, "utf8");
  await addProject(abs, name);
  return abs;
}

export async function getSession(): Promise<Session> {
  return (await loadConfig()).session;
}

export async function setSession(session: Session) {
  const cfg = await loadConfig();
  cfg.session = {
    open: session.open.filter((p) => typeof p === "string"),
    active: Number.isInteger(session.active) ? session.active : 0,
  };
  await saveConfig(cfg);
}

export async function browse(dir?: string) {
  const abs = path.resolve(dir || os.homedir());
  if (!(await isDir(abs))) throw new Error("不是目录: " + abs);
  const entries = await readdir(abs, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => ({ name: e.name, path: path.join(abs, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));
  const parent = path.dirname(abs);
  return { path: abs, parent: parent === abs ? null : parent, dirs };
}

export async function makeDir(parent: string, name: string) {
  if (!name.trim()) throw new Error("名称不能为空");
  const abs = path.resolve(parent, name);
  if (await exists(abs)) throw new Error("已存在");
  await mkdir(abs);
  return abs;
}

async function isDir(p: string) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
