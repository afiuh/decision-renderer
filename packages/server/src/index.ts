import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseTree, readNode, writeNode, createNode, deleteNode, renameNode, searchNodes } from './parse.ts'
import { rootOf, listWorkspaces } from './workspaces.ts'
import { readLayout, writeLayout, type Layout } from './layout.ts'
import { watchTree } from './watch.ts'

const app = Fastify({ logger: false })
const dist = join(fileURLToPath(new URL('.', import.meta.url)), '../../client/dist')
try { await app.register(fastifyStatic, { root: dist, prefix: '/' }) } catch { /* 开发模式没有 dist */ }

app.get('/api/workspaces', async () => listWorkspaces())
app.get<{ Querystring: { workspace?: string } }>('/api/tree', async request => parseTree(rootOf(request.query.workspace)))
app.get<{ Querystring: { workspace?: string } }>('/api/layout', async request => readLayout(rootOf(request.query.workspace)))
app.post<{ Querystring: { workspace?: string }; Body: Layout }>('/api/layout', async request => { await writeLayout(rootOf(request.query.workspace), request.body); return { ok: true } })
app.get<{ Params: { '*': string }; Querystring: { workspace?: string } }>('/api/node/*', async request => readNode(request.params['*'], rootOf(request.query.workspace)))
app.post<{ Params: { '*': string }; Querystring: { workspace?: string }; Body: { markdown: string } }>('/api/node/*', async request => { await writeNode(request.params['*'], request.body.markdown, rootOf(request.query.workspace)); return { ok: true } })
app.post<{ Querystring: { workspace?: string }; Body: { parent: string; title: string } }>('/api/node', async request => ({ id: await createNode(request.body.parent, request.body.title, rootOf(request.query.workspace)) }))
app.delete<{ Params: { '*': string }; Querystring: { workspace?: string } }>('/api/node/*', async request => { await deleteNode(request.params['*'], rootOf(request.query.workspace)); return { ok: true } })
app.patch<{ Params: { '*': string }; Querystring: { workspace?: string }; Body: { title: string } }>('/api/node/*', async request => ({ id: await renameNode(request.params['*'], request.body.title, rootOf(request.query.workspace)) }))
app.get<{ Querystring: { q: string; workspace?: string } }>('/api/search', async request => searchNodes(request.query.q, rootOf(request.query.workspace)))

const server = await app.listen({ port: 7341, host: '127.0.0.1' })
console.log('[server] http://127.0.0.1:7341')

const wss = new WebSocketServer({ server: app.server, path: '/ws' })
wss.on('connection', (socket, request) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const root = rootOf(url.searchParams.get('workspace') ?? undefined)
  socket.on('message', async raw => {
    try {
      const message = JSON.parse(String(raw)) as { type: string; id?: string }
      if (message.type === 'tree') { const { tree, edges } = await parseTree(root); socket.send(JSON.stringify({ type: 'tree', tree, edges })) }
      if (message.type === 'read' && message.id !== undefined) socket.send(JSON.stringify({ type: 'node', node: await readNode(message.id, root) }))
    } catch { /* ignore */ }
  })
  parseTree(root).then(({ tree, edges }) => socket.send(JSON.stringify({ type: 'tree', tree, edges })))
})
watchTree(({ tree, edges }) => {
  const payload = JSON.stringify({ type: 'tree', tree, edges })
  for (const client of wss.clients) if (client.readyState === 1) client.send(payload)
})
