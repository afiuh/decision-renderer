import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { CHILD_SUFFIX } from "./parse.ts";

function safePath(root: string, rel: string): string {
  const abs = path.resolve(root, rel);
  const base = path.resolve(root);
  if (abs !== base && !abs.startsWith(base + path.sep)) throw new Error("路径越界");
  return abs;
}

function assertName(name: string) {
  if (!name.trim()) throw new Error("名称不能为空");
  if (/[\u0000-\u001f/\\:*?"<>|]/.test(name)) throw new Error("名称含非法字符");
  if (name.startsWith(".")) throw new Error("名称不能以点开头");
}

export async function readNode(root: string, id: string) {
  const abs = safePath(root, id + ".md");
  const markdown = await readFile(abs, "utf8");
  const mtime = (await stat(abs)).mtimeMs;
  const title = markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? path.basename(id);
  return { id, path: id + ".md", title, markdown, mtime };
}

export async function writeNode(root: string, id: string, markdown: string) {
  const abs = safePath(root, id + ".md");
  await writeFile(abs, markdown, "utf8");
}

export async function createNode(root: string, parentId: string, title: string) {
  assertName(title);
  const parentAbs = safePath(root, parentId + ".md");
  const parentMd = await readFile(parentAbs, "utf8");
  const parentTitle = parentMd.match(/^#\s+(.+)$/m)?.[1].trim() ?? path.basename(parentId);

  const dirRel = parentId + CHILD_SUFFIX;
  const dirAbs = safePath(root, dirRel);
  await mkdir(dirAbs, { recursive: true });

  const fileAbs = path.join(dirAbs, title + ".md");
  if (await exists(fileAbs)) throw new Error("同名节点已存在");

  const parentRel = path.relative(dirAbs, parentAbs).split(path.sep).join("/");
  const body = `# ${title}\n\n**父级**：[${parentTitle}](${parentRel})\n\n## 要做什么\n\n## 为什么要做\n\n## 怎么做\n\n## 如何验证自己做对了\n`;
  await writeFile(fileAbs, body, "utf8");
  return dirRel + "/" + title;
}

export async function deleteNode(root: string, id: string) {
  const abs = safePath(root, id + ".md");
  const dirAbs = safePath(root, id + CHILD_SUFFIX);
  if (await exists(dirAbs)) {
    const left = (await readdir(dirAbs)).filter((n) => !n.startsWith("."));
    if (left.length > 0) throw new Error("该节点还有子节点，不能删除");
  }
  await rm(abs);
  if (await exists(dirAbs)) await rm(dirAbs, { recursive: true });
}

export async function renameNode(root: string, id: string, nextName: string) {
  assertName(nextName);
  if (nextName === path.basename(id)) return id;
  const parentDir = path.dirname(id) === "." ? "" : path.dirname(id);
  const nextId = parentDir ? parentDir + "/" + nextName : nextName;

  const from = safePath(root, id + ".md");
  const to = safePath(root, nextId + ".md");
  if (await exists(to)) throw new Error("目标名称已存在");
  await rename(from, to);

  const fromDir = safePath(root, id + CHILD_SUFFIX);
  const toDir = safePath(root, nextId + CHILD_SUFFIX);
  if (await exists(fromDir)) await rename(fromDir, toDir);
  return nextId;
}

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
