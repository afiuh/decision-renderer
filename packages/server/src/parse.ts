import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { TreeNode } from "@dr/shared";

export const CHILD_SUFFIX = "-子节点";

export async function parseTree(root: string): Promise<TreeNode[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const bases = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name.slice(0, -3))
    .sort((a, b) => a.localeCompare(b, "zh"));
  const nodes: TreeNode[] = [];
  for (const base of bases) nodes.push(await parseNode(root, base));
  return nodes;
}

async function parseNode(root: string, id: string): Promise<TreeNode> {
  const relPath = id + ".md";
  const md = await readFile(path.join(root, relPath), "utf8");
  const children = await parseChildren(root, id + CHILD_SUFFIX);
  return {
    id,
    title: extractTitle(md) ?? path.basename(id),
    path: relPath,
    status: extractStatus(md),
    hasChildren: children.length > 0,
    children,
  };
}

async function parseChildren(root: string, relDir: string): Promise<TreeNode[]> {
  const abs = path.join(root, relDir);
  if (!(await isDir(abs))) return [];
  const entries = await readdir(abs, { withFileTypes: true });
  const bases = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name.slice(0, -3))
    .sort((a, b) => a.localeCompare(b, "zh"));
  const out: TreeNode[] = [];
  for (const base of bases) out.push(await parseNode(root, relDir + "/" + base));
  return out;
}

function extractTitle(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function extractStatus(md: string): TreeNode["status"] {
  const section = md.match(/##\s*状态[\s\S]*?(?=\n##\s|$)/)?.[0] ?? md;
  if (/⏳/.test(section)) return "doing";
  if (/❌/.test(section)) return "todo";
  if (/✅/.test(section)) return "done";
  return "";
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
