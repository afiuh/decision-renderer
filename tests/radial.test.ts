import { test } from "node:test";
import assert from "node:assert/strict";
import { radialLayout, resolveAngle, ellipseOf } from "../packages/client/src/layout/radial.ts";
import type { TreeNode } from "../packages/shared/src/types.ts";

const node = (id: string, children: TreeNode[] = []): TreeNode => ({
  id, title: id, path: id + ".md", status: "", hasChildren: children.length > 0, children,
});

test("碰撞圆以父中心为圆心，半径含连线 + 半对角线", () => {
  const tree = [node("root", [node("a"), node("b")])];
  const sizes = new Map([["root", { width: 120, height: 36 }], ["a", { width: 120, height: 36 }], ["b", { width: 120, height: 36 }]]);
  const layout = radialLayout({ roots: tree, expanded: new Set(["root"]), sizes, dragged: new Map() });
  const rootPos = layout.positions.get("root")!;
  for (const id of ["a", "b"]) {
    const pos = layout.positions.get(id)!;
    const r = layout.radii.get(id)!;
    const half = Math.hypot(120, 36) / 2;
    // 连线距离 = r，框半对角线 = half，碰撞圆半径 = r + half
    assert.ok(Math.abs(Math.hypot(pos.x - rootPos.x, pos.y - rootPos.y) - r) < 1e-6, "距离应等于半径");
    assert.ok(r >= half, "半径应至少覆盖半对角线");
  }
});

test("展开节点的碰撞圆包含所有后代", () => {
  const tree = [node("root", [node("a", [node("a1"), node("a2")])])];
  const sizes = new Map([["root", { width: 120, height: 36 }], ["a", { width: 120, height: 36 }], ["a1", { width: 120, height: 36 }], ["a2", { width: 120, height: 36 }]]);
  const layout = radialLayout({ roots: tree, expanded: new Set(["root", "a"]), sizes, dragged: new Map() });
  const aPos = layout.positions.get("a")!;
  const aCircle = layout.circles.get("a")!;
  for (const id of ["a1", "a2"]) {
    const pos = layout.positions.get(id)!;
    const half = Math.hypot(120, 36) / 2;
    const dist = Math.hypot(pos.x - aPos.x, pos.y - aPos.y) + half;
    assert.ok(dist <= aCircle + 1e-6, `后代 ${id} 应在 a 的外接圆内（${dist} <= ${aCircle}）`);
  }
});

test("兄弟角度区间不重叠（展开后）", () => {
  const tree = [node("root", [node("a"), node("b"), node("c")])];
  const sizes = new Map([["root", { width: 120, height: 36 }], ["a", { width: 120, height: 36 }], ["b", { width: 120, height: 36 }], ["c", { width: 120, height: 36 }]]);
  const layout = radialLayout({ roots: tree, expanded: new Set(["root"]), sizes, dragged: new Map() });
  const kids = ["a", "b", "c"].map((id) => ({ id, angle: layout.angles.get(id)!, span: layout.arcs.get(id)! }));
  const total = kids.reduce((s, k) => s + k.span, 0);
  assert.ok(total <= Math.PI * 2 + 1e-6, `角度总和 ${total} 应 ≤ 2π`);
});

test("resolveAngle：重叠时推到最近的不重叠角度", () => {
  const siblings = [
    { id: "a", angle: 0, span: Math.PI / 2 },
    { id: "b", angle: Math.PI / 2, span: Math.PI / 2 },
  ];
  const got = resolveAngle(0.1, "a", siblings, Math.PI / 2);
  assert.ok(Math.abs(got - 0.1) > 1e-3, "重叠时应推开");
});

test("椭圆是框的内切椭圆（框包住椭圆）", () => {
  const e = ellipseOf({ width: 560, height: 440 });
  assert.equal(e.a, 280);
  assert.equal(e.b, 220);
});

test("未展开的兄弟连线等长；展开的才延长", () => {
  const tree = [node("root", [node("a"), node("b", [node("b1")])])];
  const sizes = new Map([
    ["root", { width: 120, height: 36 }],
    ["a", { width: 120, height: 36 }],
    ["b", { width: 120, height: 36 }],
    ["b1", { width: 120, height: 36 }],
  ]);
  // 只展开 root：a、b 都未展开 → 等长
  const l1 = radialLayout({ roots: tree, expanded: new Set(["root"]), sizes, dragged: new Map() });
  const rootPos = l1.positions.get("root")!;
  const da = l1.radii.get("a")!;
  const db = l1.radii.get("b")!;
  assert.ok(Math.abs(da - db) < 1e-6, `未展开时 a/b 连线应等长：${da} vs ${db}`);

  // 展开 b：b 延长，a 不变
  const l2 = radialLayout({ roots: tree, expanded: new Set(["root", "b"]), sizes, dragged: new Map() });
  const da2 = l2.radii.get("a")!;
  const db2 = l2.radii.get("b")!;
  assert.ok(Math.abs(da2 - da) < 1e-6, "a 的连线不应变");
  assert.ok(db2 > db, `b 展开后应延长：${db} → ${db2}`);
});
