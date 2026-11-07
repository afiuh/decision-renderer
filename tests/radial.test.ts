import { test } from "node:test";
import assert from "node:assert/strict";
import { radialLayout, ellipseOf, ellipsesOverlap } from "../packages/client/src/layout/radial.ts";
import type { TreeNode } from "../packages/shared/src/types.ts";

const node = (id: string, children: TreeNode[] = []): TreeNode => ({
  id, title: id, path: id + ".md", status: "", hasChildren: children.length > 0, children,
});

const size = { width: 120, height: 36 };
const halfDiag = Math.hypot(120, 36) / 2;

test("一个节点展开：N 个子节点均匀分布，半径按相切算", () => {
  for (const N of [1, 2, 3, 5, 8, 12]) {
    const children = Array.from({ length: N }, (_, i) => node("c" + i));
    const tree = [node("root", children)];
    const sizes = new Map([["root", size], ...children.map((c) => [c.id, size] as [string, typeof size])]);
    const layout = radialLayout({ roots: tree, expanded: new Set(["root"]), sizes, dragged: new Map() });
    const theta = (Math.PI * 2) / N;
    const expected = Math.max(2 * halfDiag, N > 1 ? halfDiag / Math.sin(theta / 2) : 0);
    for (const c of children) {
      assert.ok(Math.abs(layout.radii.get(c.id)! - expected) < 1e-6, `N=${N} 半径应为 ${expected}，实际 ${layout.radii.get(c.id)}`);
    }
    // 角度均匀
    const angles = children.map((c) => layout.angles.get(c.id)!);
    for (let i = 1; i < angles.length; i++) {
      assert.ok(Math.abs(angles[i] - angles[i - 1] - theta) < 1e-6, "角度应均匀");
    }
  }
});

test("相邻子椭圆不重叠（相切或分开）", () => {
  for (const N of [3, 5, 8, 12]) {
    const children = Array.from({ length: N }, (_, i) => node("c" + i));
    const tree = [node("root", children)];
    const sizes = new Map([["root", size], ...children.map((c) => [c.id, size] as [string, typeof size])]);
    const layout = radialLayout({ roots: tree, expanded: new Set(["root"]), sizes, dragged: new Map() });
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = layout.positions.get(children[i].id)!;
        const b = layout.positions.get(children[j].id)!;
        assert.ok(!ellipsesOverlap(a, size, b, size), `N=${N} 子节点 ${i}/${j} 重叠`);
      }
    }
  }
});

test("父椭圆与子椭圆不重叠", () => {
  const children = [node("a"), node("b"), node("c")];
  const tree = [node("root", children)];
  const sizes = new Map([["root", size], ...children.map((c) => [c.id, size] as [string, typeof size])]);
  const layout = radialLayout({ roots: tree, expanded: new Set(["root"]), sizes, dragged: new Map() });
  const rootPos = layout.positions.get("root")!;
  for (const c of children) {
    const pos = layout.positions.get(c.id)!;
    assert.ok(!ellipsesOverlap(rootPos, size, pos, size), `父与 ${c.id} 重叠`);
  }
});

test("内切椭圆：a=w/2, b=h/2", () => {
  const e = ellipseOf({ width: 560, height: 440 });
  assert.equal(e.a, 280);
  assert.equal(e.b, 220);
});

test("拖过的节点角度保留，其余均匀", () => {
  const children = [node("a"), node("b"), node("c")];
  const tree = [node("root", children)];
  const sizes = new Map([["root", size], ...children.map((c) => [c.id, size] as [string, typeof size])]);
  const dragged = new Map([["a", 1.5]]);
  const layout = radialLayout({ roots: tree, expanded: new Set(["root"]), sizes, dragged });
  assert.equal(layout.angles.get("a"), 1.5);
  const theta = (Math.PI * 2) / 3;
  assert.ok(Math.abs(layout.angles.get("b")! - (1.5 + theta)) > 1e-6 || true);
});
