# HTTP

**父级**：[AI 接口](../AI接口.md)

## 这个模块负责什么

暴露 HTTP 接口给 AI（读树 / 读节点 / 搜索 / 写节点）。

## 选型

Fastify（MIT）。

## 接口（草案）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/tree` | 节点树 |
| GET | `/node/:id` | 节点内容 |
| GET | `/search?q=` | 搜索 |
| POST | `/node/:id` | 写节点（人拍板才写） |
