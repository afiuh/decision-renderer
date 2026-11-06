# 前端代码架构（从零重写）

## 目录

```
src/
├── main.tsx
├── App.tsx                  ← 工作区切换 + 拼装
├── workspace/
│   └── useWorkspace.ts      ← WS 连接 + tree + 工作区列表
├── layout/
│   ├── radial.ts            ← 纯函数：radialLayout(tree, expanded) → { positions, parents, radii, descendants }
│   └── useLayout.ts         ← expanded + radialLayout + fitView
├── drag/
│   └── useDrag.ts           ← 拖动（沿圆周 + 子节点跟随 + 碰撞）
├── content/
│   ├── useContent.ts        ← 内容节点（parentId + 开关）
│   └── ContentNode.tsx      ← 内容窗口（Markdown + CodeMirror + NodeResizer）
├── canvas/
│   ├── Canvas.tsx           ← 拼装（< 100 行）
│   ├── NodeCard.tsx         ← 节点卡片
│   └── RoutedEdge.tsx       ← 边
└── styles.css
```

## 数据流

```
useWorkspace（tree, workspace）
  → useLayout（expanded, positions, parents, radii, descendants）
    → useDrag（parents/radii/descendants）
    → useContent（parentId）
  → Canvas（拼装）
```

## 职责边界

| 模块 | 负责 | 不负责 |
|---|---|---|
| `useWorkspace` | WS + tree + 工作区列表 | 布局/拖动 |
| `radial.ts` | 纯计算（位置/父子/半径/子孙） | React/状态 |
| `useLayout` | expanded + 布局 + fitView | 拖动/内容 |
| `useDrag` | 拖动（沿圆周 + 子节点跟随 + 碰撞） | 布局计算 |
| `useContent` | 内容节点（parentId） | 布局/拖动 |
| `Canvas` | 拼装（< 100 行） | 逻辑 |

## 原则

1. `Canvas` < 100 行（只拼装）
2. 每个 hook 单一职责
3. 纯函数（`radial.ts`）无 React 依赖
4. 数据单向：workspace → layout → drag/content → canvas
