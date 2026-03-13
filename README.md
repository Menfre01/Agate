# Agate — Your AI Gateway

一个基于 Cloudflare Workers 的多租户 AI API 网关，提供供应商管理、模型管理、API Key 管理和配额统计功能。

A multi-tenant AI API gateway built on Cloudflare Workers with provider management, model management, API key management, and quota analytics.

[Features](#特性) • [Quick Start](#快速开始) • [Documentation](#文档) • [License](#许可证)

---

## 特性 / Features

- **多租户架构** - 公司、部门、用户层级，配额隔离 / Multi-tenant hierarchy with isolated quotas
- **供应商管理** - 支持多个 AI 供应商，可自定义端点 / Multiple providers with custom endpoints
- **模型管理** - 统一的模型目录，支持多供应商关联 / Unified model catalog with provider linking
- **API Key 管理** - 细粒度的密钥管理和配额控制 / Granular key management with quota controls
- **使用分析** - Token 用量、成本分析和请求日志 / Token usage, cost analysis, and request logging
- **配额系统** - 日配额和配额池，自动重置 / Daily quotas and quota pools with auto-reset

---

## 快速开始 / Quick Start

### 本地开发 / Local Development

```bash
# 安装依赖 / Install dependencies
npm install

# 初始化本地数据库 / Initialize local database
npm run db:migrate:local
npm run db:seed:local

# 启动开发服务器 / Start dev server
npm run dev
```

服务将在 `http://localhost:8787` 启动 / Service available at `http://localhost:8787`

### 生产部署 / Production Deployment

```bash
# 快速部署（自动创建资源）/ Quick deploy (auto-creates resources)
./scripts/quick-deploy.sh

# 指定自定义域名 / With custom domain
./scripts/quick-deploy.sh ai.yourdomain.com

# 指定 account_id / With specific account_id
./scripts/quick-deploy.sh "" your-account-id
```

---

## 文档 / Documentation

| 文档 / Document | 描述 / Description |
|-----------------|-------------------|
| [API 文档 / API Reference](./docs/API.md) | 完整的 API 参考 / Complete API reference |
| [部署指南 / Deployment Guide](./docs/DEPLOYMENT.md) | 部署说明 / Deployment instructions |
| [E2E 测试 / E2E Testing](./tests/e2e/README.md) | 端到端测试指南 / E2E testing guide |

---

## API 端点 / API Endpoints

### 代理 API / Proxy API

```bash
# 获取模型列表 / List models
GET /v1/models

# 发送消息（兼容 Anthropic）/ Send message (Anthropic-compatible)
POST /v1/messages
```

### 管理 API / Admin API (需要 Admin Key / Requires Admin Key)

```bash
# API Keys
GET    /admin/keys
POST   /admin/keys
DELETE /admin/keys/:id

# 供应商 / Providers
GET    /admin/providers
POST   /admin/providers

# 模型 / Models
GET    /admin/models
POST   /admin/models

# 统计 / Statistics
GET    /admin/stats/usage
GET    /admin/stats/tokens
```

完整 API 参考请见 [API 文档](./docs/API.md) / See [API Documentation](./docs/API.md)

---

## 项目结构 / Project Structure

```
src/
├── api/           # API 路由处理器 / Route handlers
│   ├── admin/     # 管理端点 / Admin endpoints
│   └── proxy/     # 代理端点 / Proxy endpoints
├── db/            # 数据库结构和查询 / Database schema & queries
├── middleware/    # 认证、限流、日志 / Auth, rate limit, logging
├── services/      # 业务逻辑服务 / Business logic services
├── types/         # TypeScript 类型定义 / Type definitions
└── utils/         # 工具函数 / Utility functions
```

---

## 开发 / Development

```bash
# 运行测试 / Run tests
npm test

# 类型检查 / Type check
npm run typecheck

# E2E 测试 / E2E tests
./tests/e2e/run.sh
```

---

## 许可证 / License

MIT

---

## 部署文档 / Deployment Docs

- [部署指南](./docs/DEPLOYMENT.md) / [Deployment Guide](./docs/DEPLOYMENT.md)
