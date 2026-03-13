# 部署指南 / Deployment Guide

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## Deployment Guide

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
# Deploy with default workers.dev domain
./scripts/quick-deploy.sh

# Deploy with custom domain
./scripts/quick-deploy.sh ai.yourdomain.com

# Deploy with specific account_id
./scripts/quick-deploy.sh "" your-account-id
```

The script will automatically:
1. Create D1 database (if not exists)
2. Create KV namespace (if not exists)
3. Deploy database schema
4. Deploy Worker

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
wrangler d1 create ai-gateway-db

# Copy the returned database_id
```

#### Step 3: Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create "ai-gateway-cache"

# Create preview namespace
wrangler kv:namespace create "ai-gateway-cache" --preview

# Copy the returned IDs
```

#### Step 4: Create Production Config

Create `wrangler.prod.jsonc`:

```jsonc
{
  "name": "ai-gateway",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [{
    "binding": "DB",
    "database_name": "ai-gateway-db",
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
      "pattern": "ai.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

#### Step 5: Deploy Database Schema

```bash
wrangler d1 execute ai-gateway-db --file=./src/db/schema.sql --config wrangler.prod.jsonc
```

#### Step 6: Deploy Worker

```bash
npm run deploy:prod
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
wrangler d1 execute ai-gateway-db --command="DROP TABLE IF EXISTS quota_changes; DROP TABLE IF EXISTS usage_logs; ..." --local

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

#### Proxy API

- `POST /v1/messages` - Anthropic Messages API proxy
- `GET /v1/models` - Model list

#### Admin API (Requires Admin Key)

- `GET /admin/keys` - List API Keys
- `POST /admin/keys` - Create API Key
- `DELETE /admin/keys/:id` - Delete Key
- `GET /admin/providers` - List providers
- `GET /admin/models` - List models
- `GET /admin/stats/usage` - Usage statistics
- `GET /health` - Health check

---

### Monitoring

- **Cloudflare Workers Dashboard**: View request logs and errors
- **Cloudflare Analytics**: View traffic and performance
- **D1 Dashboard**: View database query statistics

---

### Troubleshooting

#### Database Connection Failed

Check `database_id` in `wrangler.prod.jsonc`.

#### KV Cache Failed

Check `kv_namespaces.id` in `wrangler.prod.jsonc`.

#### 404 After Deployment

Ensure the `routes` domain is correct and DNS points to Cloudflare.

#### Request Timeout

Verify upstream API credentials are valid.

---

<a name="简体中文"></a>
## 部署指南
