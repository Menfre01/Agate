<div align="right">

English

</div>

# Agate — 你的 AI 网关

一个基于 Cloudflare Workers 的多租户 AI API 网关，提供供应商管理、模型管理、API Key 管理和配额统计功能。

[特性](#特性) • [快速开始](#快速开始) • [文档](#文档) • [许可证](#许可证)

---

## 特性

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

# 启动开发服务器
npm run dev
```

服务将在 `http://localhost:8787` 启动

### 生产部署

```bash
# 快速部署（自动创建资源）
./scripts/quick-deploy.sh

# 指定自定义域名
./scripts/quick-deploy.sh ai.yourdomain.com

# 指定 account_id
./scripts/quick-deploy.sh "" your-account-id
```

---

## 文档

| 文档 | 描述 |
|------|------|
| [API 文档](./docs/API.md) | 完整的 API 参考 |
| [部署指南](./docs/DEPLOYMENT.md) | 部署说明 |
| [E2E 测试](./tests/e2e/README.md) | 端到端测试指南 |

---

## API 端点

### 代理 API

```bash
# 获取模型列表
GET /v1/models

# 发送消息（兼容 Anthropic）
POST /v1/messages
```

### 管理 API（需要 Admin Key）

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
src/
├── api/           # API 路由处理器
│   ├── admin/     # 管理端点
│   └── proxy/     # 代理端点
├── db/            # 数据库结构和查询
├── middleware/    # 认证、限流、日志
├── services/      # 业务逻辑服务
├── types/         # TypeScript 类型定义
└── utils/         # 工具函数
```

---

## 开发

```bash
# 运行测试
npm test

# 类型检查
npm run typecheck

# E2E 测试
./tests/e2e/run.sh
```

---

## 许可证

[MIT](./LICENSE) © 2025 Agate Contributors

---

## 部署文档

- [部署指南](./docs/DEPLOYMENT.md)
