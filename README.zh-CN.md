<div align="right">

[English](./README.md)

</div>

# Agate

<div align="center">

**你的 AI Gateway — 一个入口管理所有 LLM**

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [文档](#-文档) · [贡献](#-贡献)

</div>

---

Agate 是基于 Cloudflare Workers 构建的高性能 AI API 网关，支持两层一致性哈希负载均衡、自动化健康检查和多供应商管理。

---

## ✨ 功能特性

- **🔀 两层一致性哈希负载均衡** — 相同模型请求路由到同一供应商，优化缓存命中率
- **⚡ 自动化健康检查** — 每 5 分钟 Cron 触发，配额保护机制（~10 tokens/次）
- **🔄 多供应商管理** — 支持 Anthropic、OpenAI 及兼容 API，支持模型映射
- **🗝️ API Key 认证** — SHA-256 哈希存储 + KV 缓存
- **💰 用量分析** — Token 跟踪、成本分析、时间维度统计
- **🎨 管理后台** — 基于 Vue 3 的实时统计面板
- **🧱 Worker 分离架构** — 独立的 Proxy、Admin、Health Worker，性能最优

---

## 🚀 快速开始

### 本地开发

```bash
# 克隆并安装
git clone https://github.com/your-org/agate.git
cd agate
npm install

# 初始化本地数据库
npm run db:migrate:local
npm run db:seed:local

# 启动所有服务
pnpm dev:start
```

**服务地址：**
| 服务 | 地址 |
|------|------|
| Proxy API | `http://localhost:8787` |
| Admin API | `http://localhost:8788` |
| 管理后台 | `http://localhost:5173` |

### 生产部署

```bash
# 使用默认 workers.dev 域名部署
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID

# 使用自定义域名部署
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID \
  --proxy-domain=api.example.com \
  --admin-domain=admin.example.com
```

**脚本自动完成：**
1. 创建 D1 数据库 `agate-db` 和 KV 命名空间 `agate-cache`
2. 应用数据库迁移
3. 部署 Proxy、Admin、Health 三个 Worker
4. 部署管理后台 (Pages)
5. 生成超级管理员 API Key（保存至 `.admin-api-key`）

---

## 📸 界面预览

### 管理后台

| 仪表盘 | 日志 |
|--------|------|
| *[Dashboard 截图占位]* | *[Logs 截图占位]* |

---

## 🏗️ 架构

### 负载均衡策略

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

**为什么选择一致性哈希？**
- ✅ 缓存友好：相同请求命中同一供应商
- ✅ 自动故障切换：不健康节点自动跳过
- ✅ 配置简单：无需手动配置权重/优先级

### 健康检查机制

| 配置项 | 值 |
|--------|-----|
| 调度 | `*/5 * * * *`（每 5 分钟） |
| 粒度 | 按凭证 |
| 成本 | 约 10 tokens/次 |
| 保护 | 50k tokens/天 配额 |

**状态流转：** `unknown` → `healthy` / `unhealthy`（连续 3 次失败）

### Worker 分离

| Worker | 用途 | 路由 |
|--------|------|------|
| agate-proxy | 高频 API | `/v1/*`, `/health` |
| agate-admin | 管理操作 | `/admin/*`, `/user/*` |
| agate-health | Cron 健康检查 | `/cron/health-check` |

---

## 🔌 API 端点

### Proxy API

```bash
GET  /health           # 健康检查
GET  /v1/models        # 列出可用模型
POST /v1/messages      # Anthropic Messages API
```

### Admin API

```bash
# API Keys
GET    /admin/keys             # 列出 API keys
POST   /admin/keys             # 创建 API key
PUT    /admin/keys/:id         # 更新 API key
DELETE /admin/keys/:id         # 删除 API key

# 供应商
GET    /admin/providers                    # 列出供应商
POST   /admin/providers                    # 创建供应商
DELETE /admin/providers/:id                # 删除供应商
POST   /admin/providers/:id/credentials    # 添加凭证
GET    /admin/providers/health-status      # 获取健康状态

# 统计
GET  /admin/stats/usage           # 用量统计
GET  /admin/stats/tokens          # Token 使用汇总
GET  /admin/stats/costs           # 成本分析
GET  /admin/logs                  # 查询使用日志
```

完整 API 文档请参考 [API 文档](./docs/API.md)。

---

## 💻 客户端集成

### cURL

```bash
curl https://api.example.com/v1/messages \
  -H "x-api-key: your-api-key" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好！"}]
  }'
```

### Python (Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://api.example.com",
    api_key="your-api-key"
)

message = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    messages=[{"role": "user", "content": "你好！"}]
)
```

### JavaScript / TypeScript

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'https://api.example.com',
  apiKey: 'your-api-key',
});

const message = await client.messages.create({
  model: 'claude-3-sonnet-20240229',
  maxTokens: 1024,
  messages: [{ role: 'user', content: '你好！' }],
});
```

---

## 📖 文档

| 文档 | 描述 |
|------|------|
| [API 参考](./docs/API.md) | 完整 API 参考 |
| [部署指南](./docs/DEPLOYMENT.md) | 部署说明 |
| [架构文档](./docs/ARCHITECTURE.md) | 架构决策 (ADR) |
| [功能测试](./tests/functional/README.md) | 功能测试指南 |

---

## 🛠️ 开发

```bash
# 运行测试（带清理）
TEST_CLEANUP=true pnpm test

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 本地冒烟测试
pnpm smoke-test:local
```

### 单个 Worker 命令

```bash
# Proxy Worker
cd workers/proxy
wrangler dev    # 本地开发
wrangler deploy # 部署

# Admin Worker
cd workers/admin
wrangler dev
wrangler deploy

# Health Worker
cd workers/health
wrangler dev
wrangler deploy
```

---

## 📂 项目结构

```
agate/
├── packages/shared/        # Worker 间共享代码
│   └── src/
│       ├── db/            # 数据库架构和查询
│       ├── types/         # TypeScript 类型
│       ├── utils/         # 工具函数
│       ├── middleware/    # 认证、日志
│       └── services/      # 用量服务
│
├── workers/
│   ├── proxy/             # Proxy Worker (API 网关)
│   ├── admin/             # Admin Worker (管理)
│   └── health/            # Health Worker (cron)
│
├── pages/                 # 管理后台 (Vue 3)
├── tests/                 # 单元、集成、功能测试
├── scripts/               # 部署和工具脚本
└── docs/                  # 文档
```

---

## ⚙️ 配置

### 环境变量

| 变量 | Worker | 描述 | 默认值 |
|------|--------|------|--------|
| ENVIRONMENT | 全部 | 环境标识符 | development |
| SYSTEM_USER_ID | Health | 健康检查系统用户 | sys-health-user |

### 数据库

Agate 使用 Cloudflare D1 (SQLite)，迁移文件位于 `packages/shared/src/db/migrations/`。

---

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

---

## 📜 许可证

[MIT](./LICENSE) © 2025 Agate 贡献者

---

## 🔗 链接

- [Issues](https://github.com/your-org/agate/issues)
- [Discussions](https://github.com/your-org/agate/discussions)
- [更新日志](./CHANGELOG.md)
