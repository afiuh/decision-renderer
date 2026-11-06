# MCP

**父级**：[AI 接口](../AI接口.md)

## 这个模块负责什么

（可选）以 MCP 协议暴露同样的能力，接入 MCP 客户端。

## 选型

`@modelcontextprotocol/sdk`（MIT）。

## 状态（2026-11-06）

✅ 已实现（stdio MCP server）：
- `list_workspaces` / `list_tree` / `read_node`
- `search` / `create_node` / `write_node`
- 启动：`npm run mcp -w packages/server`
- 验证：initialize + tools/list 握手成功
