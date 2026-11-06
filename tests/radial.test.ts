import assert from "node:assert/strict";
import test from "node:test";
import type { TreeNode } from "@dr/shared";
import { radialLayout } from "../packages/client/src/layout/radial.ts";

const size = { width: 80, height: 36 };

function node(id: string, children: TreeNode[] = []): TreeNode {
  return { id, title: id, path: id + ".md", status: "", hasChildren: children.length > 0, children };
}

function sizesFor(nodes: TreeNode[]) {
  const map = new Map<string, { width: number; height: number }>();
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      map.set(n.id, size);
      walk(n.children);
    }
  };
  walk(nodes);
  return map;
}

test("未展开时，同一父节点的连线等长", () => {
  const roots = [node("root", [node("a"), node("b"), node("c")])];
  const layout = radialLayout({
    roots,
    expanded: new Set(["root"]),
    sizes: sizesFor(roots),
    dragged: new Map(),
  });
  const radii = ["a", "b", "c"].map((id) => layout.radii.get(id)!);
  assert.equal(new Set(radii.map((r) => r.toFixed(4))).size, 1);
});

test("展开一个子节点：只有它那条连线延长", () => {
  const roots = [node("root", [node("a", [node("a1"), node("a2")]), node("b"), node("c")])];
  const layout = radialLayout({
    roots,
    expanded: new Set(["root", "a"]),
    sizes: sizesFor(roots),
    dragged: new Map(),
  });
  const a = layout.radii.get("a")!;
  const b = layout.radii.get("b")!;
  const c = layout.radii.get("c")!;
  assert.ok(a > b, "展开节点的连线应当更长");
  assert.equal(b.toFixed(4), c.toFixed(4), "未展开兄弟的连线保持不变");
  assert.ok(a >= layout.radii.get("a1")!, "父到子不得小于子的占地半径");
});

test("折叠后恢复等长", () => {
  const roots = [node("root", [node("a", [node("a1")]), node("b")])];
  const sizes = sizesFor(roots);
  const open = radialLayout({ roots, expanded: new Set(["root", "a"]), sizes, dragged: new Map() });
  const closed = radialLayout({ roots, expanded: new Set(["root"]), sizes, dragged: new Map() });
  assert.ok(open.radii.get("a")! > closed.radii.get("a")!);
  assert.equal(closed.radii.get("a")!.toFixed(4), closed.radii.get("b")!.toFixed(4));
});

test("同父兄弟卡片不重叠", () => {
  const roots = [node("root", Array.from({ length: 8 }, (_, i) => node("n" + i)))];
  const layout = radialLayout({
    roots,
    expanded: new Set(["root"]),
    sizes: sizesFor(roots),
    dragged: new Map(),
  });
  const boxes = roots[0].children.map((n) => {
    const c = layout.positions.get(n.id)!;
    return { id: n.id, x1: c.x - size.width / 2, y1: c.y - size.height / 2, x2: c.x + size.width / 2, y2: c.y + size.height / 2 };
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i];
      const B = boxes[j];
      const overlap = A.x1 < B.x2 && A.x2 > B.x1 && A.y1 < B.y2 && A.y2 > B.y1;
      assert.equal(overlap, false, `${A.id} 与 ${B.id} 重叠`);
    }
  }
});

test("拖动只改角度，不改半径", () => {
  const roots = [node("root", [node("a"), node("b")])];
  const sizes = sizesFor(roots);
  const before = radialLayout({ roots, expanded: new Set(["root"]), sizes, dragged: new Map() });
  const after = radialLayout({ roots, expanded: new Set(["root"]), sizes, dragged: new Map([["a", Math.PI / 2]]) });
  assert.equal(before.radii.get("a")!.toFixed(4), after.radii.get("a")!.toFixed(4));
  assert.notEqual(before.positions.get("a")!.x.toFixed(2), after.positions.get("a")!.x.toFixed(2));
});
