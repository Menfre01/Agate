# 部署指南 / Deployment Guide

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## Deployment Guide

### Architecture Overview

Agate uses a **split-worker architecture** for optimal performance:

- **Proxy Worker** (`agate-proxy`) - Handles high-frequency API requests (`/v1/*`)
- **Admin Worker** (`agate-admin`) - Handles management operations (`/admin/*`)

Both workers share the same D1 database and KV cache.

### Table of Contents

- [Prerequisites](#prerequisites-en)
- [Quick Deploy](#quick-deploy-en)
- [Manual Deployment](#manual-deployment-en)
- [Database Management](#database-management-en)
- [Environment Variables](#environment-variables-en)
- [API Endpoints](#api-endpoints-en)
- [Monitoring](#monitoring-en)
- [Troubleshooting](#troubleshooting-en)

### Prerequisites

- Node.js >= 20.0.0
- Cloudflare account
- Wrangler CLI installed and logged in

```bash
npm install -g wrangler
wrangler login
```

---

### Quick Deploy

The easiest way to deploy is using the quick deploy script:

```bash
# Deploy with default workers.dev domains
./scripts/quick-deploy.sh

# Deploy with custom domains (proxy and admin)
./scripts/quick-deploy.sh api.yourdomain.com admin.yourdomain.com

# Deploy with specific account_id
./scripts/quick-deploy.sh "" "" your-account-id
```

The script will automatically:
1. Create D1 database (if not exists)
2. Create KV namespace (if not exists)
3. Deploy database schema
4. Deploy **both** Proxy and Admin workers

---

### Manual Deployment

#### Step 1: Clone and Install

```bash
git clone https://github.com/your-repo/ai-gateway.git
cd ai-gateway
npm install
```

#### Step 2: Create D1 Database

```bash
# Create database
wrangler d1 create agate-db

# Copy the returned database_id
```

#### Step 3: Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create "agate-cache"

# Create preview namespace
wrangler kv:namespace create "agate-cache" --preview

# Copy the returned IDs
```

#### Step 4: Create Production Configs

Create `workers/proxy/wrangler.prod.jsonc`:

```jsonc
{
  "name": "agate-proxy",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [{
    "binding": "DB",
    "database_name": "agate-db",
    "database_id": "YOUR_D1_DATABASE_ID"
  }],

  "kv_namespaces": [{
    "binding": "KV_CACHE",
    "id": "YOUR_KV_NAMESPACE_ID",
    "preview_id": "YOUR_KV_PREVIEW_ID"
  }],

  "vars": {
    "ENVIRONMENT": "production"
  },

  "routes": [
    {
      "pattern": "api.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

Create `workers/admin/wrangler.prod.jsonc`:

```jsonc
{
  "name": "agate-admin",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [{
    "binding": "DB",
    "database_name": "agate-db",
    "database_id": "YOUR_D1_DATABASE_ID"
  }],

  "kv_namespaces": [{
    "binding": "KV_CACHE",
    "id": "YOUR_KV_NAMESPACE_ID",
    "preview_id": "YOUR_KV_PREVIEW_ID"
  }],

  "vars": {
    "ENVIRONMENT": "production"
  },

  "routes": [
    {
      "pattern": "admin.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

#### Step 5: Deploy Database Schema

```bash
wrangler d1 execute agate-db --file=./packages/shared/src/db/schema.sql --config workers/proxy/wrangler.prod.jsonc
```

#### Step 6: Deploy Workers

```bash
# Deploy Proxy Worker
cd workers/proxy
wrangler deploy --config wrangler.prod.jsonc
cd ../..

# Deploy Admin Worker
cd workers/admin
wrangler deploy --config wrangler.prod.jsonc
cd ../..
```

#### Step 7: Initialize Admin API Key

```bash
node scripts/init-admin-key.js --prod --config workers/admin/wrangler.prod.jsonc
```

---

### Database Management

#### Query Data

```bash
# Local
npm run db:query:local -- "SELECT * FROM api_keys LIMIT 10"

# Production
npm run db:query -- "SELECT * FROM api_keys LIMIT 10"
```

#### Reset Database

```bash
# Local
wrangler d1 execute agate-db --command="DROP TABLE IF EXISTS quota_changes; DROP TABLE IF EXISTS usage_logs; ..." --local

# Re-migrate
npm run db:migrate:local
```

---

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| ENVIRONMENT | Environment identifier | production |

---

### API Endpoints

#### Proxy API (Proxy Worker - agate-proxy)

- `POST /v1/messages` - Anthropic Messages API proxy
- `GET /v1/models` - Model list
- `GET /health` - Health check

#### Admin API (Admin Worker - agate-admin)

- `GET /admin/keys` - List API Keys
- `POST /admin/keys` - Create API Key
- `DELETE /admin/keys/:id` - Delete Key
- `GET /admin/providers` - List providers
- `GET /admin/models` - List models
- `GET /admin/stats/usage` - Usage statistics

---

### Monitoring

- **Cloudflare Workers Dashboard**: View request logs and errors for each worker
- **Cloudflare Analytics**: View traffic and performance
- **D1 Dashboard**: View database query statistics

---

### Troubleshooting

#### Database Connection Failed

Check `database_id` in both `workers/proxy/wrangler.prod.jsonc` and `workers/admin/wrangler.prod.jsonc`.

#### KV Cache Failed

Check `kv_namespaces.id` in both worker configs.

#### 404 After Deployment

Ensure the `routes` domain is correct and DNS points to Cloudflare. Each worker has its own route configuration.

#### Request Timeout

Verify upstream API credentials are valid in the provider configuration.

---

<a name="简体中文"></a>
## 部署指南

### 架构概述

Agate 使用 **拆分 Worker 架构** 以获得最佳性能：

- **Proxy Worker** (`agate-proxy`) - 处理高频 API 请求 (`/v1/*`)
- **Admin Worker** (`agate-admin`) - 处理管理操作 (`/admin/*`)

两个 Worker 共享同一个 D1 数据库和 KV 缓存。

### 目录

- [前提条件](#前提条件)
- [快速部署](#快速部署)
- [手动部署](#手动部署)
- [数据库管理](#数据库管理)
- [环境变量](#环境变量)
- [API 端点](#api-端点)
- [监控](#监控)
- [故障排除](#故障排除)

### 前提条件

- Node.js >= 20.0.0
- Cloudflare 账户
- 已安装并登录 Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

---

### 快速部署

最简单的部署方式是使用快速部署脚本：

```bash
# 使用默认 workers.dev 域名部署
./scripts/quick-deploy.sh

# 使用自定义域名部署
./scripts/quick-deploy.sh api.yourdomain.com admin.yourdomain.com

# 指定 account_id 部署
./scripts/quick-deploy.sh "" "" your-account-id
```

脚本将自动：
1. 创建 D1 数据库（如果不存在）
2. 创建 KV 命名空间（如果不存在）
3. 部署数据库架构
4. 部署 **两个** Worker（Proxy 和 Admin）

---

### 手动部署

#### 步骤 1：克隆并安装

```bash
git clone https://github.com/your-repo/ai-gateway.git
cd ai-gateway
npm install
```

#### 步骤 2：创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create agate-db

# 复制返回的 database_id
```

#### 步骤 3：创建 KV 命名空间

```bash
# 创建生产命名空间
wrangler kv:namespace create "agate-cache"

# 创建预览命名空间
wrangler kv:namespace create "agate-cache" --preview

# 复制返回的 ID
```

#### 步骤 4：创建生产配置

创建 `workers/proxy/wrangler.prod.jsonc`：

```jsonc
{
  "name": "agate-proxy",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [{
    "binding": "DB",
    "database_name": "agate-db",
    "database_id": "你的_D1_DATABASE_ID"
  }],

  "kv_namespaces": [{
    "binding": "KV_CACHE",
    "id": "你的_KV_NAMESPACE_ID",
    "preview_id": "你的_KV_PREVIEW_ID"
  }],

  "vars": {
    "ENVIRONMENT": "production"
  },

  "routes": [
    {
      "pattern": "api.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

创建 `workers/admin/wrangler.prod.jsonc`：

```jsonc
{
  "name": "agate-admin",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [{
    "binding": "DB",
    "database_name": "agate-db",
    "database_id": "你的_D1_DATABASE_ID"
  }],

  "kv_namespaces": [{
    "binding": "KV_CACHE",
    "id": "你的_KV_NAMESPACE_ID",
    "preview_id": "你的_KV_PREVIEW_ID"
  }],

  "vars": {
    "ENVIRONMENT": "production"
  },

  "routes": [
    {
      "pattern": "admin.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

#### 步骤 5：部署数据库架构

```bash
wrangler d1 execute agate-db --file=./packages/shared/src/db/schema.sql --config workers/proxy/wrangler.prod.jsonc
```

#### 步骤 6：部署 Worker

```bash
# 部署 Proxy Worker
cd workers/proxy
wrangler deploy --config wrangler.prod.jsonc
cd ../..

# 部署 Admin Worker
cd workers/admin
wrangler deploy --config wrangler.prod.jsonc
cd ../..
```

#### 步骤 7：初始化管理员 API Key

```bash
node scripts/init-admin-key.js --prod --config workers/admin/wrangler.prod.jsonc
```

---

### 数据库管理

#### 查询数据

```bash
# 本地
npm run db:query:local -- "SELECT * FROM api_keys LIMIT 10"

# 生产环境
npm run db:query -- "SELECT * FROM api_keys LIMIT 10"
```

#### 重置数据库

```bash
# 本地
wrangler d1 execute agate-db --command="DROP TABLE IF EXISTS quota_changes; DROP TABLE IF EXISTS usage_logs; ..." --local

# 重新迁移
npm run db:migrate:local
```

---

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| ENVIRONMENT | 环境标识符 | production |

---

### API 端点

#### Proxy API（Proxy Worker - agate-proxy）

- `POST /v1/messages` - Anthropic Messages API 代理
- `GET /v1/models` - 模型列表
- `GET /health` - 健康检查

#### Admin API（Admin Worker - agate-admin）

- `GET /admin/keys` - 列出 API Keys
- `POST /admin/keys` - 创建 API Key
- `DELETE /admin/keys/:id` - 删除 Key
- `GET /admin/providers` - 列出供应商
- `GET /admin/models` - 列出模型
- `GET /admin/stats/usage` - 使用统计

---

### 监控

- **Cloudflare Workers Dashboard**：查看每个 Worker 的请求日志和错误
- **Cloudflare Analytics**：查看流量和性能
- **D1 Dashboard**：查看数据库查询统计

---

### 故障排除

#### 数据库连接失败

检查 `workers/proxy/wrangler.prod.jsonc` 和 `workers/admin/wrangler.prod.jsonc` 中的 `database_id`。

#### KV 缓存失败

检查两个 Worker 配置中的 `kv_namespaces.id`。

#### 部署后出现 404

确保 `routes` 域名正确，且 DNS 指向 Cloudflare。每个 Worker 都有自己的路由配置。

#### 请求超时

验证上游 API 凭据在供应商配置中是否有效。
