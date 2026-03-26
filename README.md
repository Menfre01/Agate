<div align="right">

[中文](./README.zh-CN.md)

</div>

# Agate

<div align="center">

**Your AI Gateway — One Hub for All LLMs**

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

Agate is a high-performance AI API gateway built on Cloudflare Workers with two-layer consistent hash load balancing, automated health checks, and multi-provider management.

---

## Features

- **Two-Layer Consistent Hash LB** — Routes same model requests to same provider for cache optimization
- **Automated Health Checks** — Cron-triggered every 5 minutes with quota protection (~10 tokens/check)
- **Multi-Provider Management** — Support for Anthropic, OpenAI, and compatible APIs with model mapping
- **API Key Authentication** — SHA-256 hashed storage with KV caching
- **Usage Analytics** — Token tracking, cost analysis, and time-based statistics
- **Admin Dashboard** — Real-time stats with Vue 3

---

## Quick Start

### Local Development

```bash
git clone git@github.com:Menfre01/agate.git
cd agate
npm install
npm run db:migrate:local
npm run db:seed:local
pnpm dev:start
```

| Service | URL |
|---------|-----|
| Proxy API | `http://localhost:8787` |
| Admin API | `http://localhost:8788` |
| Admin Dashboard | `http://localhost:5173` |

### Production Deployment

**Prerequisites:**
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (Free or Paid plan)
- Cloudflare Account ID (found in the dashboard)

```bash
git clone git@github.com:Menfre01/agate.git
cd agate
npm install
```

**Option 1: Deploy with workers.dev domains (free)**

```bash
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID
```

**Option 2: Deploy with custom domains**

```bash
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID \
  --proxy-domain=api.example.com \
  --admin-domain=admin.example.com
```

The script automatically creates D1 database, KV namespace, applies migrations, deploys workers, and generates a super admin API key.

See [Deployment Guide](./docs/DEPLOYMENT.md) for details.

---

## Architecture

Agate uses **consistent hashing** for two-layer load distribution:

```
User Request (model_id)
       ↓
Layer 1: Provider Selection (hash by api_key_id + model_id)
       ↓
Layer 2: Credential Selection (hash by api_key_id)
       ↓
Upstream API (base_url + api_key)
```

**Health Check:** `*/5 * * * *` (every 5 min), per-credential, ~10 tokens/check, 50k tokens/day quota.

Status flow: `unknown` → `healthy` / `unhealthy` (3 consecutive failures).

| Worker | Purpose | Routes |
|--------|---------|--------|
| agate-proxy | High-frequency API | `/v1/*`, `/health` |
| agate-admin | Management operations | `/admin/*`, `/user/*` |
| agate-health | Cron health checks | — |

See [Architecture](./docs/ARCHITECTURE.md) for design decisions.

---

## API Endpoints

**Proxy API**
```bash
GET  /health           # Health check
GET  /v1/models        # List available models
POST /v1/messages      # Anthropic Messages API
```

**Admin API**
```bash
# API Keys
GET    /admin/keys
POST   /admin/keys
PUT    /admin/keys/:id
DELETE /admin/keys/:id

# Providers
GET    /admin/providers
POST   /admin/providers
DELETE /admin/providers/:id
POST   /admin/providers/:id/credentials
GET    /admin/providers/health-status

# Statistics
GET  /admin/stats/usage
GET  /admin/stats/tokens
GET  /admin/stats/costs
GET  /admin/logs
```

See [API Reference](./docs/API.md) for complete documentation.

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete API reference |
| [Deployment Guide](./docs/DEPLOYMENT.md) | Deployment instructions |
| [Architecture](./docs/ARCHITECTURE.md) | Architecture decisions (ADR) |

---

## Development

```bash
# Run tests (with cleanup)
TEST_CLEANUP=true pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

---

## License

[MIT](./LICENSE) © 2025 Agate Contributors
