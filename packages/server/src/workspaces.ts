import path from "node:path";
import type { Workspace } from "@dr/shared";
import { loadConfig } from "./projects.ts";

/** 工作区 = 已导入的项目；一个都没有时退回当前项目根 */
export async function loadWorkspaces(projectRoot: string): Promise<Workspace[]> {
  const cfg = await loadConfig();
  if (cfg.projects.length === 0) {
    return [{ name: path.basename(projectRoot), root: projectRoot }];
  }
  return cfg.projects.map((p) => ({ name: p.name, root: p.path }));
}

export function findWorkspace(list: Workspace[], key?: string): Workspace {
  if (!list.length) throw new Error("没有配置项目");
  if (!key) return list[0];
  const found = list.find((w) => w.root === key || w.name === key);
  if (!found) throw new Error("项目不存在: " + key);
  return found;
}
