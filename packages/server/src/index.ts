import Fastify from 'fastify'
import { WebSocketServer } from 'ws'
import { parseTree, readNode, writeNode, createNode, searchNodes } from './parse.ts'
import { rootOf, listWorkspaces } from './workspaces.ts'
import { watchTree } from './watch.ts'

const app = Fastify({ logger: false })

app.get('/api/workspaces', async () => listWorkspaces())
app.get<{ Querystring: { workspace?: string } }>('/api/tree', async request => parseTree(rootOf(request.query.workspace)))
app.get<{ Params: { id: string }; Querystring: { workspace?: string } }>('/api/node/:id', async request => readNode(request.params.id, rootOf(request.query.workspace)))
app.post<{ Params: { id: string }; Querystring: { workspace?: string }; Body: { markdown: string } }>('/api/node/:id', async request => {
  await writeNode(request.params.id, request.body.markdown, rootOf(request.query.workspace))
  return { ok: true }
})
app.post<{ Querystring: { workspace?: string }; Body: { parent: string; title: string; markdown?: string } }>('/api/node', async request => {
  const id = await createNode(request.body.parent, request.body.title, request.body.markdown, rootOf(request.query.workspace))
  return { id }
})
app.get<{ Querystring: { q: string; workspace?: string } }>('/api/search', async request => searchNodes(request.query.q, rootOf(request.query.workspace)))

const server = await app.listen({ port: 7341, host: '127.0.0.1' })
console.log(`[server] http://127.0.0.1:7341`)

// WebSocket：读节点 / 推送树
const wss = new WebSocketServer({ server: app.server, path: '/ws' })
wss.on('connection', (socket, request) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const root = rootOf(url.searchParams.get('workspace') ?? undefined)
  socket.on('message', async raw => {
    try {
      const message = JSON.parse(String(raw)) as { type: string; id?: string }
      if (message.type === 'tree') {
        const { tree, edges } = await parseTree(root)
        socket.send(JSON.stringify({ type: 'tree', tree, edges }))
      } else if (message.type === 'read' && message.id !== undefined) {
        socket.send(JSON.stringify({ type: 'node', node: await readNode(message.id, root) }))
      }
    } catch (error) {
      socket.send(JSON.stringify({ type: 'error', message: String(error) }))
    }
  })
  // 连接即推一次树
  parseTree(root).then(({ tree, edges }) => socket.send(JSON.stringify({ type: 'tree', tree, edges })))
})

// 文件变化 → 广播最新树
watchTree(({ tree, edges }) => {
  const payload = JSON.stringify({ type: 'tree', tree, edges })
  for (const client of wss.clients) if (client.readyState === 1) client.send(payload)
})
