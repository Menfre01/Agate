<div align="right">

[English](./README.md)

</div>

# Agate — 你的 AI Gateway

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.0.1-blue)

基于 Cloudflare Workers 构建的高性能 AI API 网关，支持两层一致性哈希负载均衡、自动化健康检查和多供应商管理。

**架构：** 分离 Worker 设计以获得最佳性能
- **Proxy Worker** — 高频 API 请求 (`/v1/*`)
- **Admin Worker** — 管理操作 (`/admin/*`)
- **Health Worker** — 定期健康检查 (`*/5 * * * *`)

[功能特性](#功能特性) • [快速开始](#快速开始) • [文档](#文档) • [许可证](#许可证)

---

## 功能特性

### 核心能力
- **两层一致性哈希负载均衡**
  - 供应商层：相同模型请求路由到同一供应商（缓存友好）
  - 凭证层：在供应商凭证间分配负载
  - 不健康节点自动故障切换
- **自动化健康检查**
  - Cron 每 5 分钟触发一次
  - 凭证级别验证，配额保护
  - 自动状态跟踪和恢复
- **多供应商管理**
  - 支持 Anthropic、OpenAI 及兼容 API
  - 每个凭证可自定义端点
  - 异构供应商的模型映射
- **API Key 管理**
  - SHA-256 哈希存储 + KV 缓存
  - 基于用户的访问控制
- **用量分析**
  - Token 使用跟踪（输入/输出/总计）
  - 时间分组（小时/天/周）
  - 按模型/供应商的成本分析
- **管理后台**
  - 实时统计图表
  - API Key 持有者公开统计页面

---

## 快速开始

### 本地开发

```bash
# 克隆并安装
git clone https://github.com/your-org/agate.git
cd agate
npm install

# 初始化本地数据库
npm run db:migrate:local
npm run db:seed:local

# 启动所有服务（Proxy + Admin + Health + Pages）
pnpm dev:start
```

服务地址：
- **Proxy API:** `http://localhost:8787`
- **Admin API:** `http://localhost:8788`
- **管理后台:** `http://localhost:5173`

### 生产部署

```bash
# 使用默认 workers.dev 域名部署
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID

# 使用自定义域名部署
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID --proxy-domain=api.example.com --admin-domain=admin.example.com
```

**脚本自动完成：**
1. 创建 D1 数据库 `agate-db`（如需要）
2. 创建 KV 命名空间 `agate-cache`（如需要）
3. 应用所有数据库迁移
4. 部署 Proxy、Admin、Health 三个 Worker
5. 部署管理后台 (Pages)
6. 生成超级管理员 API Key 并保存至 `.admin-api-key`

---

## 架构

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
- 缓存友好：相同请求命中同一供应商
- 自动故障切换：不健康节点自动跳过
- 配置简单：无需手动配置权重/优先级

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

## API 端点

### Proxy API (端口 8787)

```bash
GET  /health                    # 健康检查
GET  /v1/models                 # 列出可用模型
POST /v1/messages               # Anthropic Messages API
```

### Admin API (端口 8788)

```bash
# API Keys
GET    /admin/keys              # 列出 API keys
POST   /admin/keys              # 创建 API key
PUT    /admin/keys/:id          # 更新 API key
POST   /admin/keys/:id/disable  # 禁用 API key
POST   /admin/keys/:id/enable   # 启用 API key
DELETE /admin/keys/:id          # 删除 API key

# 供应商
GET    /admin/providers                     # 列出供应商
POST   /admin/providers                     # 创建供应商
GET    /admin/providers/:id                 # 获取供应商详情
PUT    /admin/providers/:id                 # 更新供应商
DELETE /admin/providers/:id                 # 删除供应商
POST   /admin/providers/:id/credentials     # 添加凭证
DELETE /admin/providers/credentials/:id     # 删除凭证
GET    /admin/providers/health-status       # 获取所有健康状态
POST   /admin/providers/credentials/:id/health-check  # 手动检查

# 模型
GET    /admin/models                          # 列出模型
POST   /admin/models                          # 创建模型
GET    /admin/models/:id                      # 获取模型详情
PUT    /admin/models/:id                      # 更新模型
DELETE /admin/models/:id                      # 删除模型
GET    /admin/models/:id/providers            # 列出模型的供应商
POST   /admin/models/:id/providers            # 添加供应商到模型
DELETE /admin/models/:id/providers/:providerId # 移除供应商

# 统计
GET    /admin/stats/usage                    # 用量统计
GET    /admin/stats/tokens                   # Token 使用汇总
GET    /admin/stats/costs                    # 成本分析
GET    /admin/stats/models                   # 模型统计
GET    /admin/stats/provider-models          # 供应商-模型统计
GET    /admin/logs                           # 查询使用日志

# 用户
GET    /admin/users                          # 列出用户
POST   /admin/users                          # 创建用户
PUT    /admin/users/:id                      # 更新用户
DELETE /admin/users/:id                      # 删除用户
```

### User API (端口 8788)

```bash
GET  /user/auth                   # 获取当前用户信息
GET  /user/stats/tokens           # Token 使用汇总
GET  /user/stats/tokens/trend     # Token 使用趋势
```

完整 API 文档请参考 [API 文档](./docs/API.md)。

---

## 项目结构

```
agate/
├── packages/
│   └── shared/              # Worker 间共享代码
│       ├── src/
│       │   ├── db/          # 数据库架构和查询
│       │   ├── types/       # TypeScript 类型
│       │   ├── utils/       # 工具函数
│       │   ├── middleware/  # 认证、日志
│       │   └── services/    # 用量服务
│
├── workers/
│   ├── proxy/               # Proxy Worker (API 网关)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/proxy/   # /v1/* 处理器
│   │       ├── services/    # 代理、负载均衡
│   │       └── utils/       # 一致性哈希
│   │
│   ├── admin/               # Admin Worker (管理)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/admin/   # /admin/* 处理器
│   │       └── services/    # 用量、密钥管理
│   │
│   └── health/              # Health Worker (cron)
│       └── src/
│           ├── index.ts
│           └── services/    # 健康检查逻辑
│
├── pages/                   # 管理后台 (Vue 3)
│   └── src/
│       ├── views/
│       │   ├── admin/      # 管理仪表盘
│       │   └── public-stats/  # 公共统计页面
│       └── shared/
│           ├── api/        # API 客户端
│           └── components/ # 共享组件
│
├── tests/
│   ├── unit/               # 单元测试
│   ├── integration/        # 集成测试
│   └── functional/         # 功能测试
│
├── scripts/                # 部署和工具脚本
├── docs/                   # 文档
└── package.json
```

---

## 开发

```bash
# 运行测试
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
wrangler dev                # 本地开发
wrangler deploy             # 部署

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

## 文档

| 文档 | 描述 |
|------|------|
| [API 参考](./docs/API.md) | 完整 API 参考 |
| [部署指南](./docs/DEPLOYMENT.md) | 部署说明 |
| [架构文档](./docs/ARCHITECTURE.md) | 架构决策 (ADR) |
| [功能测试](./tests/functional/README.md) | 功能测试指南 |

---

## 配置

### 环境变量

| 变量 | Worker | 描述 | 默认值 |
|------|--------|------|--------|
| ENVIRONMENT | 全部 | 环境标识符 | development |
| SYSTEM_USER_ID | Health | 健康检查系统用户 | sys-health-user |

### 数据库

Agate 使用 Cloudflare D1 (SQLite)，迁移文件位于 `packages/shared/src/db/migrations/`。

---

## 许可证

[MIT](./LICENSE) © 2025 Agate 贡献者

---

## 链接

- [Issues](https://github.com/your-org/agate/issues)
- [Discussions](https://github.com/your-org/agate/discussions)
