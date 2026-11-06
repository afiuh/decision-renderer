/** MCP server（stdio）：暴露决策网络的树/节点/搜索/新建/写入。 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { parseTree, readNode, writeNode, createNode, searchNodes } from './parse.ts'
import { rootOf, listWorkspaces } from './workspaces.ts'

const server = new Server(
  { name: 'decision-renderer', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

const text = (value: unknown): { content: Array<{ type: 'text'; text: string }> } => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'list_workspaces', description: '列出所有决策网络工作区', inputSchema: { type: 'object', properties: {} } },
    { name: 'list_tree', description: '读取工作区的节点树（标题/状态/子节点）', inputSchema: { type: 'object', properties: { workspace: { type: 'string' } } } },
    { name: 'read_node', description: '读取单个节点的 Markdown 内容', inputSchema: { type: 'object', properties: { id: { type: 'string' }, workspace: { type: 'string' } }, required: ['id'] } },
    { name: 'search', description: '全文搜索节点（标题+内容）', inputSchema: { type: 'object', properties: { q: { type: 'string' }, workspace: { type: 'string' } }, required: ['q'] } },
    { name: 'create_node', description: '在父节点下新建子节点', inputSchema: { type: 'object', properties: { parent: { type: 'string' }, title: { type: 'string' }, workspace: { type: 'string' } }, required: ['parent', 'title'] } },
    { name: 'write_node', description: '写入节点内容（覆盖）', inputSchema: { type: 'object', properties: { id: { type: 'string' }, markdown: { type: 'string' }, workspace: { type: 'string' } }, required: ['id', 'markdown'] } },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const args = (request.params.arguments ?? {}) as Record<string, string>
  const root = rootOf(args.workspace)
  switch (request.params.name) {
    case 'list_workspaces': return text(listWorkspaces())
    case 'list_tree': return text(await parseTree(root))
    case 'read_node': return text(await readNode(args.id ?? '', root))
    case 'search': return text(await searchNodes(args.q ?? '', root))
    case 'create_node': return text({ id: await createNode(args.parent ?? '', args.title ?? '', undefined, root) })
    case 'write_node': await writeNode(args.id ?? '', args.markdown ?? '', root); return text({ ok: true })
    default: throw new Error(`unknown tool: ${request.params.name}`)
  }
})

await server.connect(new StdioServerTransport())
