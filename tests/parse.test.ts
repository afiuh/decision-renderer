import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseTree } from "../packages/server/src/parse.ts";

test("目录结构 → 节点树", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dr-parse-"));
  try {
    await writeFile(path.join(root, "根.md"), "# 根节点\n\n## 状态\n\n⏳ 进行中\n");
    await mkdir(path.join(root, "根-子节点"));
    await writeFile(path.join(root, "根-子节点", "子.md"), "# 子节点\n\n✅ 完成\n");
    await mkdir(path.join(root, "根-子节点", "子-子节点"));
    await writeFile(path.join(root, "根-子节点", "子-子节点", "孙.md"), "没有标题\n");

    const tree = await parseTree(root);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].title, "根节点");
    assert.equal(tree[0].status, "doing");
    assert.equal(tree[0].children.length, 1);

    const child = tree[0].children[0];
    assert.equal(child.id, "根-子节点/子");
    assert.equal(child.status, "done");
    assert.equal(child.children[0].title, "孙");
    assert.equal(child.children[0].id, "根-子节点/子-子节点/孙");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("非法子目录（没有对应 .md）不产出节点", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dr-parse-"));
  try {
    await writeFile(path.join(root, "A.md"), "# A\n");
    await mkdir(path.join(root, "孤儿-子节点"));
    await writeFile(path.join(root, "孤儿-子节点", "X.md"), "# X\n");
    const tree = await parseTree(root);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].children.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
