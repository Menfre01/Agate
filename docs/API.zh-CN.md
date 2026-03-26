<div align="right">

[English](./API.md)

</div>

# API 文档

### 目录

- [概述](#概述)
- [认证](#认证)
- [代理 API](#代理-api)
- [管理 API](#管理-api)
- [用户 API](#用户-api)
- [错误代码](#错误代码)
- [速率限制](#速率限制)

### 概述

Agate 使用 **拆分 Worker 架构**，API 端点由不同的 Worker 提供服务：

- **Proxy Worker** — 处理 `/v1/*` 端点（高频 API 请求）
- **Admin Worker** — 处理 `/admin/*` 和 `/user/*` 端点（管理操作）

生产环境中，这些通常部署在不同的域名上：
- Proxy: `https://api.yourdomain.com` 或 `https://agate-proxy.YOUR_ACCOUNT.workers.dev`
- Admin: `https://admin.yourdomain.com` 或 `https://agate-admin.YOUR_ACCOUNT.workers.dev`

**本地开发环境：**
- Proxy: `http://localhost:8787`
- Admin: `http://localhost:8788`

所有 API 请求都需要通过 `x-api-key` 请求头传递 API 密钥。

```bash
# 健康检查（Proxy Worker）
curl http://localhost:8787/health

# 管理 API（Admin Worker）
curl -H "x-api-key: sk-your-api-key" http://localhost:8788/admin/keys
```

### 认证

#### API Key 格式

API 密钥必须以 `sk-` 开头，且至少 20 个字符。

#### 密钥角色

| 角色 | 描述 |
|------|------|
| `admin` | 完全访问所有 Admin API 端点 |
| `user` | 仅访问 Proxy API 和 User API |

### 代理 API

#### 健康检查

检查网关是否运行。

```bash
GET /health
```

**响应：**
```json
{
  "status": "ok",
  "timestamp": 1704067200000,
  "environment": "production"
}
```

#### 获取模型列表

获取您的 API 密钥可用的模型。

```bash
GET /v1/models
```

**响应：**
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-3-5-sonnet-20241022",
      "name": "Claude 3.5 Sonnet",
      "context_length": 200000,
      "max_tokens": 8192
    }
  ]
}
```

#### 发送消息

代理 Anthropic Messages API 请求。

```bash
POST /v1/messages
```

**请求体：**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 1024,
  "messages": [
    {"role": "user", "content": "你好，世界！"}
  ]
}
```

### 管理 API

所有端点都需要具有 `admin` 角色的 API 密钥。

#### 认证

```bash
GET /admin/auth    # 验证 API 密钥并返回用户信息
```

**响应：**
```json
{
  "apiKeyId": "key_123",
  "userId": "u_456",
  "userEmail": "user@example.com",
  "userName": "张三",
  "userRole": "admin",
  "companyId": "co_789",
  "companyName": "示例公司",
  "departmentId": "dept_101",
  "departmentName": "工程部",
  "quotaDaily": 1000000,
  "quotaUsed": 50000,
  "quotaBonus": 0,
  "quotaBonusExpiry": null,
  "isUnlimited": false,
  "isActive": true,
  "expiresAt": null
}
```

#### 公司管理

```bash
GET    /admin/companies          # 列出公司
POST   /admin/companies          # 创建公司
GET    /admin/companies/:id      # 获取公司详情
PUT    /admin/companies/:id      # 更新公司
DELETE /admin/companies/:id      # 删除公司
```

**创建公司请求：**
```json
{
  "name": "示例公司",
  "quota_pool": 10000000,
  "quota_daily": 1000000
}
```

#### 部门管理

```bash
GET    /admin/departments                    # 列出部门（可选 ?company_id=）
POST   /admin/departments                    # 创建部门
GET    /admin/departments/:id                # 获取部门详情
PUT    /admin/departments/:id                # 更新部门
DELETE /admin/departments/:id                # 删除部门
POST   /admin/departments/:id/models         # 设置部门模型权限
```

**创建部门请求：**
```json
{
  "company_id": "co_123",
  "name": "工程部",
  "quota_pool": 5000000,
  "quota_daily": 500000
}
```

**设置模型权限请求：**
```json
{
  "model_id": "claude-3-5-sonnet-20241022",
  "is_allowed": true,
  "daily_quota": 100000
}
```

#### 用户管理

```bash
GET    /admin/users                      # 列出用户（可选 ?company_id=, ?department_id=）
POST   /admin/users                      # 创建用户
GET    /admin/users/:id                  # 获取用户详情
PUT    /admin/users/:id                  # 更新用户
DELETE /admin/users/:id                  # 删除用户
```

**创建用户请求：**
```json
{
  "email": "user@example.com",
  "name": "张三",
  "company_id": "co_123",      // 可选，第二期预留
  "department_id": "dept_456", // 可选，第二期预留
  "role": "user",
  "quota_daily": 100000
}
```

**第一期说明：** `company_id` 和 `department_id` 为可选字段，留待第二期使用，第一期业务逻辑不依赖这些字段。

#### API Key 管理

```bash
GET    /admin/keys                    # 列出密钥（可选 ?user_id=, ?company_id=, ?department_id=）
POST   /admin/keys                    # 创建密钥
GET    /admin/keys/:id                # 获取密钥详情
PUT    /admin/keys/:id                # 更新密钥
DELETE /admin/keys/:id                # 删除密钥
POST   /admin/keys/:id/disable        # 禁用密钥
POST   /admin/keys/:id/enable         # 启用密钥
POST   /admin/keys/:id/bonus          # 添加奖励配额
```

**创建密钥请求：**
```json
{
  "user_id": "u_123",
  "name": "生产环境密钥",
  "quota_daily": 100000,
  "expires_at": null
}
```

**添加奖励配额请求：**
```json
{
  "amount": 1000000,
  "expiry": 1735689600000
}
```

#### 供应商管理

```bash
GET    /admin/providers                       # 列出供应商
POST   /admin/providers                       # 创建供应商
GET    /admin/providers/:id                   # 获取供应商详情
PUT    /admin/providers/:id                   # 更新供应商
DELETE /admin/providers/:id                   # 删除供应商
GET    /admin/providers/:id/credentials       # 列出供应商凭证
POST   /admin/providers/:id/credentials       # 添加凭证
DELETE /admin/providers/credentials/:id       # 删除凭证
DELETE /admin/providers/:id/credentials/:credentialId  # 删除凭证（嵌套路由）
GET    /admin/providers/health-status         # 获取所有凭证健康状态
POST   /admin/providers/credentials/:id/health-check  # 手动触发健康检查
```

**创建供应商请求：**
```json
{
  "name": "anthropic",
  "display_name": "Anthropic",
  "base_url": "https://api.anthropic.com"
}
```

**添加凭证请求：**
```json
{
  "credential_name": "primary",
  "api_key": "sk-ant-...",
  "base_url": "https://api.anthropic.com"
}
```

**说明：** 已移除 `priority` 和 `weight` 字段，改用一致性哈希算法。

#### 模型管理

```bash
GET    /admin/models                          # 列出模型
POST   /admin/models                          # 创建模型
GET    /admin/models/:id                      # 获取模型详情
PUT    /admin/models/:id                      # 更新模型
DELETE /admin/models/:id                      # 删除模型
GET    /admin/models/:id/providers            # 列出模型的供应商
POST   /admin/models/:id/providers            # 添加供应商到模型
DELETE /admin/models/:id/providers/:providerId # 从模型移除供应商
```

**创建模型请求：**
```json
{
  "model_id": "claude-3-5-sonnet-20241022",
  "display_name": "Claude 3.5 Sonnet",
  "context_window": 200000,
  "max_tokens": 8192
}
```

**添加供应商请求：**
```json
{
  "provider_id": "prov_123",
  "input_price": 0.003,
  "output_price": 0.015
}
```

#### 配额管理

```bash
GET    /admin/quotas                                # 列出配额
PUT    /admin/quotas/:entityType/:entityId          # 更新配额
POST   /admin/quotas/:entityType/:entityId/reset    # 重置配额
POST   /admin/quotas/:entityType/:entityId/bonus    # 添加奖励配额
```

**entityType：** `company` | `department` | `api_key`

**更新配额请求：**
```json
{
  "quota_type": "daily",
  "quota_value": 1000000,
  "reason": "新项目需求增加"
}
```

#### 统计分析

```bash
GET /admin/stats/usage               # 使用统计
GET /admin/stats/tokens              # Token 用量
GET /admin/stats/costs               # 成本分析
GET /admin/stats/models              # 模型使用统计
GET /admin/stats/provider-models     # 供应商-模型使用统计
GET /admin/stats/health-check        # 健康检查统计
GET /admin/stats/health-check/usage  # 健康检查使用日志
```

**使用统计参数：**
- `start_at` - 开始时间戳（可选）
- `end_at` - 结束时间戳（可选）
- `company_id` - 按公司筛选（可选）
- `department_id` - 按部门筛选（可选）
- `user_id` - 按用户筛选（可选）
- `model_id` - 按模型筛选（可选）
- `group_by` - 分组方式：`department` | `user` | `model` | `day`（可选）

#### 日志查询

```bash
GET /admin/logs    # 查询使用日志
```

**查询参数：**
- `start_at` - 开始时间戳（可选）
- `end_at` - 结束时间戳（可选）
- `user_id` - 按用户筛选（可选）
- `company_id` - 按公司筛选（可选）
- `department_id` - 按部门筛选（可选）
- `model_id` - 按模型筛选（可选）
- `api_key_id` - 按 API 密钥筛选（可选）
- `status` - 按状态筛选：`success` | `error`（可选）
- `page` - 页码（默认：1）
- `page_size` - 每页条目（默认：50，最大：500）

### 用户 API

用户 API 端点需要具有 `user` 或 `admin` 角色的 API 密钥。`/user/*` 端点会自动过滤数据，仅返回当前认证用户的信息。

#### 认证

```bash
GET /user/auth    # 验证 API 密钥并返回用户信息（/admin/auth 的别名）
```

#### Token 统计

```bash
GET /user/stats/tokens          # Token 用量汇总（自动过滤当前用户）
GET /user/stats/tokens/trend    # Token 用量趋势（按时间段分组）
```

**Token 统计参数：**
- `period` - 时间周期：`hour` | `day` | `week` | `month`（默认：`day`）

### 错误代码

| 代码 | 消息 | 错误类型 |
|------|------|----------|
| 400 | 请求参数错误 | `invalid_request_error` |
| 401 | 未授权 | `authentication_error` |
| 402 | 配额已用尽 | `quota_exceeded_error` |
| 404 | 资源未找到 | `not_found_error` |
| 405 | 方法不允许 | `method_not_allowed` |
| 409 | 资源冲突 | `conflict_error` |
| 429 | 请求过于频繁 | `rate_limit_error` |
| 500 | 服务器错误 | `internal_error` |

**错误响应格式：**
```json
{
  "error": {
    "type": "error_type",
    "message": "详细错误信息",
    "status": 400,
    "request_id": "uuid"
  }
}
```

### 速率限制

API 请求受速率限制以防止滥用。

**默认限制：**
- 生产环境：每 60 秒 100 次请求
- 开发环境：每 60 秒 10000 次请求

**速率限制响应头：**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

超过速率限制时：
```json
{
  "error": {
    "type": "rate_limit_error",
    "message": "请求过于频繁，请稍后重试。",
    "status": 429
  }
}
```
