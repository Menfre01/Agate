<div align="right">

[简体中文](./API.zh-CN.md)

</div>

# API Documentation

### Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Proxy API](#proxy-api)
- [Admin API](#admin-api)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)

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
  "company_id": "co_123",      // Optional, reserved for V2 Phase 2
  "department_id": "dept_456", // Optional, reserved for V2 Phase 2
  "role": "user",
  "quota_daily": 100000
}
```

**Note for V2 Phase 1:** `company_id` and `department_id` are optional. These fields are reserved for future Phase 2 implementation and are not used in business logic during Phase 1.

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
  "base_url": "https://api.anthropic.com"
}
```

**Note:** `priority` and `weight` fields are removed in V2 (consistent hash algorithm is used instead).

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
