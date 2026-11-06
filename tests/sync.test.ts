import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseTree, writeNode } from '../packages/server/src/parse.ts'

test('编辑同步：写回后 parseTree 反映新标题/状态', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dr-sync-'))
  await writeFile(join(root, '测试节点.md'), '# 测试节点\n\n⏳ 进行中\n', 'utf8')
  await mkdir(join(root, '测试节点-子节点'))
  await writeFile(join(root, '测试节点-子节点', '子节点.md'), '# 子节点\n\n✅ 完成\n', 'utf8')

  const first = await parseTree(root)
  assert.equal(first.tree.children.length, 1)
  assert.equal(first.tree.children[0].title, '测试节点')
  assert.equal(first.tree.children[0].status, 'partial')
  assert.equal(first.edges.length, 2)

  await writeNode('测试节点', '# 测试节点（改）\n\n✅ 完成\n', root)
  const second = await parseTree(root)
  assert.equal(second.tree.children[0].title, '测试节点（改）')
  assert.equal(second.tree.children[0].status, 'done')
  assert.match(await readFile(join(root, '测试节点.md'), 'utf8'), /测试节点（改）/)

  await rm(root, { recursive: true, force: true })
})
