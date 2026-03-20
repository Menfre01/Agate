# API 文档 / API Documentation

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## API Documentation

### Table of Contents

- [Overview](#overview-en)
- [Authentication](#authentication-en)
- [Proxy API](#proxy-api-en)
- [Admin API](#admin-api-en)
- [Error Codes](#error-codes-en)
- [Rate Limiting](#rate-limiting-en)

### Overview

Agate uses a **split-worker architecture** where API endpoints are served by different workers:

- **Proxy Worker** — Handles `/v1/*` endpoints (high-frequency API requests)
- **Admin Worker** — Handles `/admin/*` endpoints (management operations)

In production, these are typically deployed on separate domains:
- Proxy: `https://api.yourdomain.com` or `https://agate-proxy.YOUR_ACCOUNT.workers.dev`
- Admin: `https://admin.yourdomain.com` or `https://agate-admin.YOUR_ACCOUNT.workers.dev`

**Local Development:**
- Proxy: `http://localhost:8787`
- Admin: `http://localhost:8788`

All API requests require an API key passed via the `x-api-key` header.

```bash
# Health check (Proxy Worker)
curl http://localhost:8787/health

# Admin API (Admin Worker)
curl -H "x-api-key: sk-your-api-key" http://localhost:8788/admin/keys
```

### Authentication

#### API Key Format

API keys must start with `sk-` and be at least 20 characters long.

#### Key Roles

| Role | Description |
|------|-------------|
| `admin` | Full access to all Admin API endpoints |
| `user` | Access to Proxy API only |

### Proxy API

#### Health Check

Check if the gateway is running.

```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1704067200000,
  "environment": "production"
}
```

#### List Models

Get available models for your API key.

```bash
GET /v1/models
```

**Response:**
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

#### Send Message

Proxy an Anthropic Messages API request.

```bash
POST /v1/messages
```

**Request Body:**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 1024,
  "messages": [
    {"role": "user", "content": "Hello, world!"}
  ]
}
```

### Admin API

All endpoints require an API key with `admin` role.

#### Authentication

```bash
GET /admin/auth    # Verify API key and return user info
```

**Response:**
```json
{
  "apiKeyId": "key_123",
  "userId": "u_456",
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "userRole": "admin",
  "companyId": "co_789",
  "companyName": "Acme Corp",
  "departmentId": "dept_101",
  "departmentName": "Engineering",
  "quotaDaily": 1000000,
  "quotaUsed": 50000,
  "quotaBonus": 0,
  "quotaBonusExpiry": null,
  "isUnlimited": false,
  "isActive": true,
  "expiresAt": null
}
```

#### Companies

```bash
GET    /admin/companies          # List companies
POST   /admin/companies          # Create company
GET    /admin/companies/:id      # Get company details
PUT    /admin/companies/:id      # Update company
DELETE /admin/companies/:id      # Delete company
```

**Create Company Request:**
```json
{
  "name": "Acme Corp",
  "quota_pool": 10000000,
  "quota_daily": 1000000
}
```

#### Departments

```bash
GET    /admin/departments                    # List departments (optional ?company_id=)
POST   /admin/departments                    # Create department
GET    /admin/departments/:id                # Get department details
PUT    /admin/departments/:id                # Update department
DELETE /admin/departments/:id                # Delete department
POST   /admin/departments/:id/models         # Set model permission for department
```

**Create Department Request:**
```json
{
  "company_id": "co_123",
  "name": "Engineering",
  "quota_pool": 5000000,
  "quota_daily": 500000
}
```

**Set Model Permission Request:**
```json
{
  "model_id": "claude-3-5-sonnet-20241022",
  "is_allowed": true,
  "daily_quota": 100000
}
```

#### Users

```bash
GET    /admin/users                      # List users (optional ?company_id=, ?department_id=)
POST   /admin/users                      # Create user
GET    /admin/users/:id                  # Get user details
PUT    /admin/users/:id                  # Update user
DELETE /admin/users/:id                  # Delete user
```

**Create User Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "company_id": "co_123",
  "department_id": "dept_456",
  "role": "user",
  "quota_daily": 100000
}
```

#### API Keys

```bash
GET    /admin/keys                    # List keys (optional ?user_id=, ?company_id=, ?department_id=)
POST   /admin/keys                    # Create key
GET    /admin/keys/:id                # Get key details
PUT    /admin/keys/:id                # Update key
DELETE /admin/keys/:id                # Delete key
POST   /admin/keys/:id/disable        # Disable key
POST   /admin/keys/:id/enable         # Enable key
POST   /admin/keys/:id/bonus          # Add bonus quota
```

**Create Key Request:**
```json
{
  "user_id": "u_123",
  "name": "Production Key",
  "quota_daily": 100000,
  "expires_at": null
}
```

**Add Bonus Quota Request:**
```json
{
  "amount": 1000000,
  "expiry": 1735689600000
}
```

#### Providers

```bash
GET    /admin/providers                       # List providers
POST   /admin/providers                       # Create provider
GET    /admin/providers/:id                   # Get provider details
PUT    /admin/providers/:id                   # Update provider
DELETE /admin/providers/:id                   # Delete provider
POST   /admin/providers/:id/credentials       # Add credential
DELETE /admin/providers/credentials/:id       # Delete credential
GET    /admin/providers/health-status         # Get all credentials health status
POST   /admin/providers/credentials/:id/health-check  # Trigger health check
```

**Create Provider Request:**
```json
{
  "name": "anthropic",
  "display_name": "Anthropic",
  "base_url": "https://api.anthropic.com"
}
```

**Add Credential Request:**
```json
{
  "credential_name": "primary",
  "api_key": "sk-ant-...",
  "base_url": "https://api.anthropic.com",
  "priority": 0,
  "weight": 1
}
```

#### Models

```bash
GET    /admin/models                          # List models
POST   /admin/models                          # Create model
GET    /admin/models/:id                      # Get model details
PUT    /admin/models/:id                      # Update model
DELETE /admin/models/:id                      # Delete model
GET    /admin/models/:id/providers            # List model providers
POST   /admin/models/:id/providers            # Add provider to model
DELETE /admin/models/:id/providers/:providerId # Remove provider from model
```

**Create Model Request:**
```json
{
  "model_id": "claude-3-5-sonnet-20241022",
  "display_name": "Claude 3.5 Sonnet",
  "context_window": 200000,
  "max_tokens": 8192
}
```

**Add Provider to Model Request:**
```json
{
  "provider_id": "prov_123",
  "input_price": 0.003,
  "output_price": 0.015
}
```

#### Quotas

```bash
GET    /admin/quotas                                # List quotas
PUT    /admin/quotas/:entityType/:entityId          # Update quota
POST   /admin/quotas/:entityType/:entityId/reset    # Reset quota
POST   /admin/quotas/:entityType/:entityId/bonus    # Add bonus quota
```

**entityType:** `company` | `department` | `api_key`

**Update Quota Request:**
```json
{
  "quota_type": "daily",
  "quota_value": 1000000,
  "reason": "Increased for new project"
}
```

#### Statistics

```bash
GET /admin/stats/usage               # Usage statistics
GET /admin/stats/tokens              # Token usage
GET /admin/stats/costs               # Cost analysis
GET /admin/stats/models              # Model usage statistics
GET /admin/stats/health-check        # Health check statistics
GET /admin/stats/health-check/usage  # Health check usage logs
```

**Usage Statistics Parameters:**
- `start_at` - Start timestamp (optional)
- `end_at` - End timestamp (optional)
- `company_id` - Filter by company (optional)
- `department_id` - Filter by department (optional)
- `user_id` - Filter by user (optional)
- `model_id` - Filter by model (optional)
- `group_by` - Group by: `department` | `user` | `model` | `day` (optional)

#### Logs

```bash
GET /admin/logs    # Query usage logs
```

**Query Parameters:**
- `start_at` - Start timestamp (optional)
- `end_at` - End timestamp (optional)
- `user_id` - Filter by user (optional)
- `company_id` - Filter by company (optional)
- `department_id` - Filter by department (optional)
- `model_id` - Filter by model (optional)
- `api_key_id` - Filter by API key (optional)
- `status` - Filter by status: `success` | `error` (optional)
- `page` - Page number (default: 1)
- `page_size` - Items per page (default: 50, max: 500)

### Error Codes

| Code | Message | Error Type |
|------|---------|------------|
| 400 | Bad Request | `invalid_request_error` |
| 401 | Unauthorized | `authentication_error` |
| 402 | Quota Exceeded | `quota_exceeded_error` |
| 404 | Not Found | `not_found_error` |
| 405 | Method Not Allowed | `method_not_allowed` |
| 409 | Conflict | `conflict_error` |
| 429 | Rate Limit Exceeded | `rate_limit_error` |
| 500 | Internal Server Error | `internal_error` |

**Error Response Format:**
```json
{
  "error": {
    "type": "error_type",
    "message": "Detailed error message",
    "status": 400,
    "request_id": "uuid"
  }
}
```

### Rate Limiting

API requests are rate limited to prevent abuse.

**Default Limits:**
- Production: 100 requests per 60 seconds
- Development: 10000 requests per 60 seconds

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

When rate limit is exceeded:
```json
{
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded. Please try again later.",
    "status": 429
  }
}
```

---

<a name="简体中文"></a>
## API 文档

### 目录

- [概述](#概述-zh)
- [认证](#认证-zh)
- [代理 API](#代理-api-zh)
- [管理 API](#管理-api-zh)
- [错误代码](#错误代码-zh)
- [速率限制](#速率限制-zh)

### 概述

Agate 使用 **拆分 Worker 架构**，API 端点由不同的 Worker 提供服务：

- **Proxy Worker** — 处理 `/v1/*` 端点（高频 API 请求）
- **Admin Worker** — 处理 `/admin/*` 端点（管理操作）

生产环境中，这些通常部署在不同的域名上：
- Proxy: `https://api.yourdomain.com` 或 `https://agate-proxy.YOUR_ACCOUNT.workers.dev`
- Admin: `https://admin.yourdomain.com` 或 `https://agate-admin.YOUR_ACCOUNT.workers.dev`

**本地开发环境：**
- Proxy: `http://localhost:8787`
- Admin: `http://localhost:8788`

所有 API 请求都需要通过 `x-api-key` 请求头传递 API 密钥。

### 认证

#### API Key 格式

API 密钥必须以 `sk-` 开头，且至少 20 个字符。

#### 密钥角色

| 角色 | 描述 |
|------|------|
| `admin` | 完全访问所有 Admin API 端点 |
| `user` | 仅访问 Proxy API |

### 代理 API

#### 健康检查

```bash
GET /health
```

#### 获取模型列表

```bash
GET /v1/models
```

#### 发送消息

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
  "company_id": "co_123",
  "department_id": "dept_456",
  "role": "user",
  "quota_daily": 100000
}
```

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
POST   /admin/providers/:id/credentials       # 添加凭证
DELETE /admin/providers/credentials/:id       # 删除凭证
GET    /admin/providers/health-status         # 查看所有凭证健康状态
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
  "base_url": "https://api.anthropic.com",
  "priority": 0,
  "weight": 1
}
```

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
