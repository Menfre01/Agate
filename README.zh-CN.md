<div align="right">

English

</div>

# Agate — 你的 AI 网关

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)

一个基于 Cloudflare Workers 的多租户 AI API 网关，提供供应商管理、模型管理、API Key 管理和配额统计功能。

**架构设计：** 拆分 Worker 设计以获得最佳性能
- **Proxy Worker** — 高频 API 请求 (`/v1/*`)
- **Admin Worker** — 管理操作 (`/admin/*`)

[特性](#特性) • [快速开始](#快速开始) • [文档](#文档) • [许可证](#许可证)

---

## 特性

- **拆分 Worker 架构** — Proxy 和 Admin Worker 分别优化性能
- **多租户架构** — 公司、部门、用户层级，配额隔离
- **供应商管理** — 支持多个 AI 供应商，可自定义端点
- **模型管理** — 统一的模型目录，支持多供应商关联
- **API Key 管理** — 细粒度的密钥管理和配额控制
- **使用分析** — Token 用量、成本分析和请求日志
- **配额系统** — 日配额和配额池，自动重置

---

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 初始化本地数据库
npm run db:migrate:local
npm run db:seed:local

# 启动开发服务器（Proxy 和 Admin）
npm run dev
```

服务地址：
- **Proxy API:** `http://localhost:8787`
- **Admin API:** `http://localhost:8788`

### 生产部署

```bash
# 快速部署（自动创建资源，部署两个 Worker）
./scripts/quick-deploy.sh

# 指定自定义域名
./scripts/quick-deploy.sh api.yourdomain.com admin.yourdomain.com

# 指定 account_id
./scripts/quick-deploy.sh "" "" your-account-id
```

---

## 文档

| 文档 | 描述 |
|------|------|
| [API 文档](./docs/API.md) | 完整的 API 参考 |
| [部署指南](./docs/DEPLOYMENT.md) | 部署说明 |
| [功能测试](./tests/functional/README.md) | 功能测试指南 |

---

## API 端点

### 代理 API（Proxy Worker — 端口 8787）

```bash
# 健康检查
GET /health

# 获取模型列表
GET /v1/models

# 发送消息（兼容 Anthropic）
POST /v1/messages
```

### 管理 API（Admin Worker — 端口 8788）

```bash
# API Keys
GET    /admin/keys
POST   /admin/keys
DELETE /admin/keys/:id

# 供应商
GET    /admin/providers
POST   /admin/providers

# 模型
GET    /admin/models
POST   /admin/models

# 统计
GET    /admin/stats/usage
GET    /admin/stats/tokens
```

完整 API 参考请见 [API 文档](./docs/API.md)

---

## 项目结构

```
agate/
├── packages/
│   └── shared/          # Worker 间共享代码
│       ├── src/
│       │   ├── db/      # 数据库结构和查询
│       │   ├── types/   # TypeScript 类型
│       │   ├── utils/   # 工具函数
│       │   ├── middleware/  # 认证、限流、日志
│       │   └── services/    # 共享服务（缓存等）
│       └── package.json
│
├── workers/
│   ├── proxy/           # Proxy Worker（高频 API）
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/proxy/
│   │       ├── middleware/
│   │       └── services/
│   │   ├── wrangler.jsonc
│   │   └── wrangler.prod.jsonc
│   │
│   └── admin/           # Admin Worker（管理操作）
│       └── src/
│           ├── index.ts
│           ├── api/admin/
│           ├── middleware/
│           └── services/
│       ├── wrangler.jsonc
│       └── wrangler.prod.jsonc
│
├── tests/
│   ├── unit/            # 单元测试
│   ├── integration/     # 集成测试
│   ├── functional/      # 功能测试（API 端点）
│   └── fixtures/        # 测试工具和数据
│
├── scripts/             # 部署和工具脚本
├── docs/                # 文档
└── package.json         # 根包（workspaces）
```

---

## 开发

```bash
# 运行测试
npm test

# 运行特定测试套件
npm run test:unit
npm run test:integration
npm run test:functional

# 类型检查
npm run typecheck

# 运行冒烟测试
npm run smoke-test:local
```

### 单独的 Worker 命令

```bash
# 只启动 Proxy Worker
npm run dev:proxy

# 只启动 Admin Worker
npm run dev:admin

# 只部署 Proxy Worker
npm run deploy:proxy

# 只部署 Admin Worker
npm run deploy:admin
```

---

## 许可证

[MIT](./LICENSE) © 2025 Agate Contributors

---

## 部署文档

- [部署指南](./docs/DEPLOYMENT.md)
