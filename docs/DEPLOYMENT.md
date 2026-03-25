<div align="right">

[简体中文](./DEPLOYMENT.zh-CN.md)

</div>

# Deployment Guide

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
