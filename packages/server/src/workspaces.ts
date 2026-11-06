import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Workspace } from "@dr/shared";

export async function loadWorkspaces(projectRoot: string): Promise<Workspace[]> {
  const file = path.join(projectRoot, "workspaces.json");
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as Workspace[];
    return raw.filter((w) => w && typeof w.root === "string").map((w) => ({
      name: w.name || path.basename(w.root),
      root: path.resolve(projectRoot, w.root),
    }));
  } catch {
    return [{ name: path.basename(projectRoot), root: projectRoot }];
  }
}

export function findWorkspace(list: Workspace[], name?: string): Workspace {
  if (!list.length) throw new Error("没有配置工作区");
  if (!name) return list[0];
  const found = list.find((w) => w.name === name);
  if (!found) throw new Error("工作区不存在: " + name);
  return found;
}
