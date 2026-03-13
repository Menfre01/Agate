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

### Overview

**Base URL:** `https://your-gateway.example.com`

All API requests require an API key passed via the `x-api-key` header.

```bash
curl -H "x-api-key: sk-your-api-key" https://your-gateway.example.com/health
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

#### Companies

```bash
GET    /admin/companies    # List companies
POST   /admin/companies    # Create company
DELETE /admin/companies/:id # Delete company
```

#### API Keys

```bash
GET    /admin/keys              # List keys
POST   /admin/keys              # Create key
DELETE /admin/keys/:id          # Delete key
POST   /admin/keys/:id/disable   # Disable key
POST   /admin/keys/:id/bonus     # Add bonus quota
```

#### Providers

```bash
GET    /admin/providers                    # List providers
POST   /admin/providers                    # Create provider
POST   /admin/providers/:id/credentials   # Add credential
```

#### Models

```bash
GET    /admin/models                                  # List models
POST   /admin/models                                  # Create model
POST   /admin/models/:id/link?provider_id=:provider_id # Link to provider
```

#### Statistics

```bash
GET /admin/stats/usage   # Usage statistics
GET /admin/stats/tokens  # Token usage
GET /admin/stats/costs   # Cost analysis
```

### Error Codes

| Code | Message |
|------|---------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 402 | Quota Exceeded |
| 404 | Not Found |
| 500 | Internal Server Error |

---

<a name="简体中文"></a>
## API 文档

### 目录

- [概述](#概述-zh)
- [认证](#认证-zh)
- [代理 API](#代理-api-zh)
- [管理 API](#管理-api-zh)
- [错误代码](#错误代码-zh)

### 概述

**Base URL:** `https://your-gateway.example.com`

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

#### 公司管理

```bash
GET    /admin/companies    # 列出公司
POST   /admin/companies    # 创建公司
DELETE /admin/companies/:id # 删除公司
```

#### API Key 管理

```bash
GET    /admin/keys              # 列出密钥
POST   /admin/keys              # 创建密钥
DELETE /admin/keys/:id          # 删除密钥
POST   /admin/keys/:id/disable   # 禁用密钥
POST   /admin/keys/:id/bonus     # 添加奖励配额
```

#### 供应商管理

```bash
GET    /admin/providers                    # 列出供应商
POST   /admin/providers                    # 创建供应商
POST   /admin/providers/:id/credentials   # 添加凭证
```

#### 模型管理

```bash
GET    /admin/models                                  # 列出模型
POST   /admin/models                                  # 创建模型
POST   /admin/models/:id/link?provider_id=:provider_id # 关联供应商
```

#### 统计分析

```bash
GET /admin/stats/usage   # 使用统计
GET /admin/stats/tokens  # Token 用量
GET /admin/stats/costs   # 成本分析
```

### 错误代码

| 代码 | 消息 |
|------|------|
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 402 | 配额已用尽 |
| 404 | 资源未找到 |
| 500 | 服务器错误 |
