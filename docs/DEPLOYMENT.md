# 部署指南 / Deployment Guide

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## Deployment Guide

### Architecture Overview

Agate uses a **multi-worker architecture** for optimal performance:

- **Proxy Worker** (`agate-proxy`) - Handles high-frequency API requests (`/v1/*`)
- **Admin Worker** (`agate-admin`) - Handles management operations (`/admin/*`)
- **Health Worker** (`agate-health`) - Periodic health checks for provider credentials (cron: `*/5 * * * *`)

All workers share the same D1 database and KV cache.

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

# Deploy with custom domains
./scripts/quick-deploy.sh --proxy-domain=api.example.com --admin-domain=admin.example.com

# Deploy with specific account ID
./scripts/quick-deploy.sh --account-id=your-account-id

# Deploy with custom domains and account ID
./scripts/quick-deploy.sh --proxy-domain=api.example.com --admin-domain=admin.example.com --account-id=your-account-id
```

The script will automatically:
1. Create D1 database (if not exists)
2. Create KV namespace (if not exists)
3. Apply database migrations (idempotent incremental migrations)
4. Deploy Proxy, Admin, and Health workers
5. Deploy Admin Frontend (Pages)
6. Initialize super admin API key

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

#### Step 5: Apply Database Migrations

```bash
# Apply all pending migrations (idempotent)
wrangler d1 migrations apply agate-db --remote --config workers/proxy/wrangler.prod.jsonc
```

This command:
- Tracks which migrations have been applied
- Only runs new migrations
- Is safe to run multiple times (idempotent)

**Migrations include:**
- `0001_initial.sql` - Initial database schema
- `0002_update_provider_credentials.sql` - Health check fields
- `0003_update_users_for_system.sql` - System user support
- `0004_create_system_user.sql` - System user for health checks
- `0005_seed_prod_data.sql` - Production seed data (providers, models, demo company)
- `0006_add_actual_model_id.sql` - Add actual_model_id to model_providers for heterogeneous provider mapping

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

# Deploy Health Worker (cron: */5 * * * *)
cd workers/health
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

| Variable | Worker | Description | Default |
|----------|--------|-------------|---------|
| ENVIRONMENT | All | Environment identifier | production |
| SYSTEM_USER_ID | Health | System user ID for health check logging | sys-health-user |
| SYSTEM_COMPANY_ID | Health | System company ID for health check | sys-health |

---

### API Endpoints

For complete API documentation, see [API Documentation](./API.md).

**Quick Overview:**
- **Proxy Worker** (`agate-proxy`): `/v1/*` - Anthropic Messages API proxy
- **Admin Worker** (`agate-admin`): `/admin/*` - Management operations
- **Health Worker** (`agate-health`): Cron-triggered health checks

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

#### Health Check Not Working

1. Verify system user exists: `SELECT * FROM users WHERE id = 'sys-health-user'`
2. Check Health Worker has `SYSTEM_USER_ID` and `SYSTEM_COMPANY_ID` vars
3. Ensure migrations were applied: `wrangler d1 migrations list agate-db --remote --config workers/proxy/wrangler.prod.jsonc`

---

<a name="简体中文"></a>
## 部署指南

### 架构概述

Agate 使用 **多 Worker 架构** 以获得最佳性能：

- **Proxy Worker** (`agate-proxy`) - 处理高频 API 请求 (`/v1/*`)
- **Admin Worker** (`agate-admin`) - 处理管理操作 (`/admin/*`)
- **Health Worker** (`agate-health`) - 定期检查供应商凭证健康状态 (cron: `*/5 * * * *`)

所有 Worker 共享同一个 D1 数据库和 KV 缓存。

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
./scripts/quick-deploy.sh --proxy-domain=api.example.com --admin-domain=admin.example.com

# 指定 account ID 部署
./scripts/quick-deploy.sh --account-id=your-account-id

# 使用自定义域名和 account ID 部署
./scripts/quick-deploy.sh --proxy-domain=api.example.com --admin-domain=admin.example.com --account-id=your-account-id
```

脚本将自动：
1. 创建 D1 数据库（如果不存在）
2. 创建 KV 命名空间（如果不存在）
3. 应用数据库迁移（幂等的增量迁移）
4. 部署三个 Worker（Proxy、Admin、Health）
5. 部署 Admin Frontend (Pages)
6. 初始化超级管理员 API Key

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

创建 `workers/health/wrangler.prod.jsonc`：

```jsonc
{
  "name": "agate-health",
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
    "ENVIRONMENT": "production",
    "SYSTEM_USER_ID": "sys-health-user",
    "SYSTEM_COMPANY_ID": "sys-health"
  },

  "triggers": [
    {
      "cron": "*/5 * * * *"
    }
  ]
}
```

#### 步骤 5：应用数据库迁移

```bash
# 应用所有待处理的迁移（幂等）
wrangler d1 migrations apply agate-db --remote --config workers/proxy/wrangler.prod.jsonc
```

该命令：
- 跟踪已应用的迁移
- 仅运行新的迁移
- 可安全多次执行（幂等）

**迁移包括：**
- `0001_initial.sql` - 初始数据库架构
- `0002_update_provider_credentials.sql` - 健康检查字段
- `0003_update_users_for_system.sql` - 系统用户支持
- `0004_create_system_user.sql` - 健康检查系统用户
- `0005_seed_prod_data.sql` - 生产种子数据（供应商、模型、演示公司）
- `0006_add_actual_model_id.sql` - 添加 actual_model_id 字段用于异构供应商模型映射

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

# 部署 Health Worker（cron: */5 * * * *）
cd workers/health
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

| 变量 | Worker | 描述 | 默认值 |
|------|--------|------|--------|
| ENVIRONMENT | 全部 | 环境标识符 | production |
| SYSTEM_USER_ID | Health | 健康检查系统用户 ID | sys-health-user |
| SYSTEM_COMPANY_ID | Health | 健康检查系统公司 ID | sys-health |

---

### API 端点

完整的 API 文档请参考 [API 文档](./API.md)。

**快速概览：**
- **Proxy Worker** (`agate-proxy`)：`/v1/*` - Anthropic Messages API 代理
- **Admin Worker** (`agate-admin`)：`/admin/*` - 管理操作
- **Health Worker** (`agate-health`)：Cron 触发的健康检查

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

#### 健康检查不工作

1. 检查系统用户是否存在：`SELECT * FROM users WHERE id = 'sys-health-user'`
2. 确认 Health Worker 配置了 `SYSTEM_USER_ID` 和 `SYSTEM_COMPANY_ID` 变量
3. 确保迁移已应用：`wrangler d1 migrations list agate-db --remote --config workers/proxy/wrangler.prod.jsonc`
