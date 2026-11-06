# 代码架构

## 目录

```
packages/
├── shared/types.ts          ← TreeNode / TreeEdge / NodeContent
├── server/src/
│   ├── parse.ts             ← 目录 → 树 + 边（read/write/create/delete/rename/search）
│   ├── git.ts               ← dirty（git status）
│   ├── layout.ts            ← .layout.json（读写）
│   ├── watch.ts             ← chokidar（文件变化）
│   ├── workspaces.ts        ← 工作区配置
│   ├── index.ts             ← Fastify + WS + static
│   └── mcp.ts               ← MCP server（stdio）
└── client/src/
    ├── workspace/useWorkspace.ts   ← WS + tree
    ├── layout/
    │   ├── radial.ts        ← 纯函数（圆心/半径/角度/子孙）
    │   ├── useLayout.ts     ← expanded + layout
    │   ├── useNodes.ts      ← nodes + 中心→左上角
    │   └── useFitView.ts    ← fitView
    ├── drag/useDrag.ts      ← 沿圆周 + 子节点跟随
    ├── content/useContent.ts + ContentNode.tsx
    ├── canvas/Canvas.tsx + NodeCard.tsx + RoutedEdge.tsx
    ├── App.tsx / main.tsx
    └── styles.css
```

## 数据流

```
useWorkspace（tree, edges）
  → useLayout（expanded, layout）
    → useNodes（nodes）
    → useDrag（parents/radii/descendants）
    → useContent（parentId）
  → Canvas（拼装）
```

## 原则

1. `Canvas` < 100 行（只拼装）
2. 每个 hook 单一职责
3. `radial.ts` 纯函数（无 React）
4. 数据单向
