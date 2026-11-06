import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { parseTree } from "./parse.ts";
import { createNode, readNode, writeNode } from "./write.ts";
import { findWorkspace, loadWorkspaces } from "./workspaces.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.DR_ROOT
  ? path.resolve(process.env.DR_ROOT)
  : path.resolve(here, "../../..");

const workspaces = await loadWorkspaces(projectRoot);
const wsOf = (name?: string) => findWorkspace(workspaces, name);

const server = new McpServer({ name: "decision-renderer", version: "0.1.0" });

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

server.registerTool(
  "list_workspaces",
  { description: "列出所有决策网络工作区" },
  async () => text(workspaces.map((w) => ({ name: w.name, root: w.root }))),
);

server.registerTool(
  "list_tree",
  {
    description: "读取决策网络的节点树",
    inputSchema: { workspace: z.string().optional() },
  },
  async ({ workspace }) => text(await parseTree(wsOf(workspace).root)),
);

server.registerTool(
  "read_node",
  {
    description: "读取单个节点的 Markdown 正文",
    inputSchema: { id: z.string(), workspace: z.string().optional() },
  },
  async ({ id, workspace }) => text(await readNode(wsOf(workspace).root, id)),
);

server.registerTool(
  "search",
  {
    description: "全文搜索决策节点",
    inputSchema: { q: z.string(), workspace: z.string().optional() },
  },
  async ({ q, workspace }) => {
    const root = wsOf(workspace).root;
    const tree = await parseTree(root);
    const hits: { id: string; title: string; snippet: string }[] = [];
    const walk = async (nodes: typeof tree) => {
      for (const n of nodes) {
        const content = await readNode(root, n.id);
        const i = content.markdown.toLowerCase().indexOf(q.toLowerCase());
        if (i >= 0) {
          hits.push({
            id: n.id,
            title: n.title,
            snippet: content.markdown.slice(Math.max(0, i - 60), i + 90).replace(/\s+/g, " "),
          });
        }
        await walk(n.children);
      }
    };
    await walk(tree);
    return text(hits.slice(0, 30));
  },
);

server.registerTool(
  "create_node",
  {
    description: "在指定父节点下新建子节点",
    inputSchema: { parent: z.string(), title: z.string(), workspace: z.string().optional() },
  },
  async ({ parent, title, workspace }) => text({ id: await createNode(wsOf(workspace).root, parent, title) }),
);

server.registerTool(
  "write_node",
  {
    description: "整篇写回节点正文",
    inputSchema: { id: z.string(), markdown: z.string(), workspace: z.string().optional() },
  },
  async ({ id, markdown, workspace }) => {
    await writeNode(wsOf(workspace).root, id, markdown);
    return text({ ok: true });
  },
);

await server.connect(new StdioServerTransport());
