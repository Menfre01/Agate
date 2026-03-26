<div align="right">

[English](./README.md)

</div>

# Agate

<div align="center">

**你的 AI Gateway — 一个入口管理所有 LLM**

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

Agate 是基于 Cloudflare Workers 构建的高性能 AI API 网关，支持两层一致性哈希负载均衡、自动化健康检查和多供应商管理。

---

## 功能特性

- **两层一致性哈希负载均衡** — 相同模型请求路由到同一供应商，优化缓存命中率
- **自动化健康检查** — 每 5 分钟 Cron 触发，配额保护机制（~10 tokens/次）
- **多供应商管理** — 支持 Anthropic、OpenAI 及兼容 API，支持模型映射
- **API Key 认证** — SHA-256 哈希存储 + KV 缓存
- **用量分析** — Token 跟踪、成本分析、时间维度统计
- **管理后台** — 基于 Vue 3 的实时统计面板

---

## 快速开始

### 本地开发

```bash
git clone git@github.com:Menfre01/agate.git
cd agate
npm install
npm run db:migrate:local
npm run db:seed:local
pnpm dev:start
```

| 服务 | 地址 |
|------|------|
| Proxy API | `http://localhost:8787` |
| Admin API | `http://localhost:8788` |
| 管理后台 | `http://localhost:5173` |

### 生产部署

**前置要求：**
- [Cloudflare 帐号](https://dash.cloudflare.com/sign-up)（免费或付费计划）
- Cloudflare Account ID（可在控制台获取）

```bash
git clone git@github.com:Menfre01/agate.git
cd agate
npm install
```

**选项 1：使用 workers.dev 域名部署（免费）**

```bash
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID
```

**选项 2：使用自定义域名部署**

```bash
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID \
  --proxy-domain=api.example.com \
  --admin-domain=admin.example.com
```

脚本自动创建 D1 数据库、KV 命名空间、应用迁移、部署 Worker 并生成超级管理员 API Key。

详见 [部署指南](./docs/DEPLOYMENT.zh-CN.md)。

---

## 架构

Agate 使用**一致性哈希**实现两层负载分布：

```
用户请求 (model_id)
       ↓
第一层：供应商选择 (按 api_key_id + model_id 哈希)
       ↓
第二层：凭证选择 (按 api_key_id 哈希)
       ↓
上游 API (base_url + api_key)
```

**健康检查：** `*/5 * * * *`（每 5 分钟），按凭证，约 10 tokens/次，50k tokens/天配额。

状态流转：`unknown` → `healthy` / `unhealthy`（连续 3 次失败）。

| Worker | 用途 | 路由 |
|--------|------|------|
| agate-proxy | 高频 API | `/v1/*`, `/health` |
| agate-admin | 管理操作 | `/admin/*`, `/user/*` |
| agate-health | Cron 健康检查 | — |

详见 [架构文档](./docs/ARCHITECTURE.zh-CN.md)。

---

## API 端点

**Proxy API**
```bash
GET  /health           # 健康检查
GET  /v1/models        # 列出可用模型
POST /v1/messages      # Anthropic Messages API
```

**Admin API**
```bash
# API Keys
GET    /admin/keys
POST   /admin/keys
PUT    /admin/keys/:id
DELETE /admin/keys/:id

# 供应商
GET    /admin/providers
POST   /admin/providers
DELETE /admin/providers/:id
POST   /admin/providers/:id/credentials
GET    /admin/providers/health-status

# 统计
GET  /admin/stats/usage
GET  /admin/stats/tokens
GET  /admin/stats/costs
GET  /admin/logs
```

完整文档请参考 [API 参考](./docs/API.zh-CN.md)。

---

## 文档

| 文档 | 描述 |
|------|------|
| [API 参考](./docs/API.zh-CN.md) | 完整 API 参考 |
| [部署指南](./docs/DEPLOYMENT.zh-CN.md) | 部署说明 |
| [架构文档](./docs/ARCHITECTURE.zh-CN.md) | 架构决策 (ADR) |

---

## 开发

```bash
# 运行测试（带清理）
TEST_CLEANUP=true pnpm test

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

---

## 许可证

[MIT](./LICENSE) © 2025 Agate 贡献者
