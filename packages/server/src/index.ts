import Fastify from 'fastify'
import { WebSocketServer } from 'ws'
import { parseTree, readNode, writeNode, createNode, searchNodes } from './parse.ts'
import { watchTree } from './watch.ts'

const app = Fastify({ logger: false })

app.get('/api/tree', async () => parseTree())
app.get<{ Params: { id: string } }>('/api/node/:id', async request => readNode(request.params.id))
app.post<{ Params: { id: string }; Body: { markdown: string } }>('/api/node/:id', async request => {
  await writeNode(request.params.id, request.body.markdown)
  return { ok: true }
})
app.post<{ Body: { parent: string; title: string; markdown?: string } }>('/api/node', async request => {
  const id = await createNode(request.body.parent, request.body.title, request.body.markdown)
  return { id }
})
app.get<{ Querystring: { q: string } }>('/api/search', async request => searchNodes(request.query.q))

const server = await app.listen({ port: 7341, host: '127.0.0.1' })
console.log(`[server] http://127.0.0.1:7341`)

// WebSocket：读节点 / 推送树
const wss = new WebSocketServer({ server: app.server, path: '/ws' })
wss.on('connection', socket => {
  socket.on('message', async raw => {
    try {
      const message = JSON.parse(String(raw)) as { type: string; id?: string }
      if (message.type === 'tree') {
        const { tree, edges } = await parseTree()
        socket.send(JSON.stringify({ type: 'tree', tree, edges }))
      } else if (message.type === 'read' && message.id !== undefined) {
        socket.send(JSON.stringify({ type: 'node', node: await readNode(message.id) }))
      }
    } catch (error) {
      socket.send(JSON.stringify({ type: 'error', message: String(error) }))
    }
  })
  // 连接即推一次树
  parseTree().then(({ tree, edges }) => socket.send(JSON.stringify({ type: 'tree', tree, edges })))
})

// 文件变化 → 广播最新树
watchTree(({ tree, edges }) => {
  const payload = JSON.stringify({ type: 'tree', tree, edges })
  for (const client of wss.clients) if (client.readyState === 1) client.send(payload)
})
