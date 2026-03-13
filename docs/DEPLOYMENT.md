# AI Gateway 部署指南

## 前置条件

- Node.js >= 20.0.0
- Cloudflare 账号
- Wrangler CLI 已安装并登录

```bash
npm install -g wrangler
wrangler login
```

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化本地数据库

```bash
# 创建并初始化表结构
npm run db:migrate:local

# （可选）插入种子数据
npm run db:seed:local
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务将在 http://localhost:8787 启动。

### 4. 运行测试

```bash
# 单元测试
npm test

# 集成测试（需要数据库）
npm run db:migrate:local && npm test

# 冒烟测试
# 需要先创建 API Key，然后运行：
npm run smoke-test http://localhost:8787 YOUR_API_KEY
```

## 生产部署

### 1. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create ai-gateway-db

# 记录返回的 database_id，更新到 wrangler.prod.jsonc
```

### 2. 创建 KV 命名空间

```bash
# 创建 KV 命名空间
wrangler kv:namespace create "KV_CACHE"
wrangler kv:namespace create "KV_CACHE" --preview

# 记录返回的 id，更新到 wrangler.prod.jsonc
```

### 3. 更新生产配置

编辑 `wrangler.prod.jsonc`，填入实际的 ID：

```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "ai-gateway-db",
    "database_id": "your-actual-database-id"
  }],
  "kv_namespaces": [{
    "binding": "KV_CACHE",
    "id": "your-actual-kv-id",
    "preview_id": "your-actual-kv-preview-id"
  }]
}
```

### 4. 执行数据库迁移

```bash
# 生产环境迁移
npm run db:migrate

# （可选）插入种子数据
npm run db:seed
```

### 5. 部署

```bash
# 部署到 Cloudflare Workers
npm run deploy:prod
```

### 6. 运行冒烟测试

```bash
npm run smoke-test https://your-gateway.example.com YOUR_ADMIN_API_KEY
```

## 数据库管理

### 查询数据

```bash
# 本地查询
npm run db:query:local -- "SELECT * FROM api_keys LIMIT 10"

# 生产查询
npm run db:query -- "SELECT * FROM api_keys LIMIT 10"
```

### 重置数据库

```bash
# 本地
wrangler d1 execute ai-gateway-db --command="DROP TABLE IF EXISTS quota_changes; DROP TABLE IF EXISTS usage_logs; DROP TABLE IF EXISTS provider_credentials; DROP TABLE IF EXISTS api_keys; DROP TABLE IF EXISTS department_models; DROP TABLE IF EXISTS model_providers; DROP TABLE IF EXISTS models; DROP TABLE IF EXISTS providers; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS departments; DROP TABLE IF EXISTS companies;" --local

# 然后重新迁移
npm run db:migrate:local
```

## 环境变量

生产环境需要配置以下变量（在 `wrangler.prod.jsonc` 中）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| ENVIRONMENT | 环境标识 | production |
| DB | D1 数据库绑定 | - |
| KV_CACHE | KV 缓存绑定 | - |

## API 端点

### 代理 API

- `POST /v1/messages` - Anthropic Messages API 代理
- `GET /v1/models` - 模型列表

### 管理 API（需要 Admin API Key）

- `GET /admin/keys` - 列出 API Keys
- `POST /admin/keys` - 创建 API Key
- `GET /admin/keys/:id` - 获取 Key 详情
- `PUT /admin/keys/:id` - 更新 Key
- `DELETE /admin/keys/:id` - 删除 Key
- `POST /admin/keys/:id/disable` - 禁用 Key
- `POST /admin/keys/:id/enable` - 启用 Key
- `POST /admin/keys/:id/bonus` - 添加奖励配额

- `GET /admin/providers` - 列出供应商
- `POST /admin/providers` - 创建供应商
- `POST /admin/providers/:id/credentials` - 添加凭证

- `GET /admin/models` - 列出模型
- `POST /admin/models` - 创建模型

- `GET /admin/quotas` - 查询配额
- `PUT /admin/quotas/:id` - 更新配额
- `POST /admin/quotas/:id/reset` - 重置配额

- `GET /admin/stats/usage` - 使用统计
- `GET /admin/stats/tokens` - Token 使用
- `GET /admin/stats/costs` - 成本分析
- `GET /admin/stats/models` - 模型统计
- `GET /admin/logs` - 查询日志

### 健康检查

- `GET /health` - 服务健康状态

## 监控

- Cloudflare Workers Dashboard：查看请求日志和错误
- Cloudflare Analytics：查看流量和性能
- D1 Dashboard：查看数据库查询统计

## 故障排查

### 数据库连接失败

检查 `wrangler.prod.jsonc` 中的 `database_id` 是否正确。

### KV 缓存失败

检查 `wrangler.prod.jsonc` 中的 `kv_namespaces.id` 是否正确。

### 部署后 404

确认 `routes` 配置中的域名是否正确，且 DNS 已指向 Cloudflare。

### 请求超时

检查上游 API (Anthropic) 的凭证是否有效。
