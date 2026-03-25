<div align="right">

[中文](./README.zh-CN.md)

</div>

# Agate — Your AI Gateway

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.0.1-blue)

A high-performance AI API gateway built on Cloudflare Workers with two-layer consistent hash load balancing, automated health checks, and multi-provider management.

**Architecture:** Split-worker design for optimal performance
- **Proxy Worker** — High-frequency API requests (`/v1/*`)
- **Admin Worker** — Management operations (`/admin/*`)
- **Health Worker** — Periodic health checks (`*/5 * * * *`)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [License](#license)

---

## Features

### Core Capabilities
- **Two-Layer Consistent Hash Load Balancing**
  - Provider-level: Routes same model requests to same provider (cache-friendly)
  - Credential-level: Distributes load across provider credentials
  - Automatic failover for unhealthy nodes
- **Automated Health Checks**
  - Cron-triggered every 5 minutes
  - Credential-level validation with quota protection
  - Automatic status tracking and recovery
- **Multi-Provider Management**
  - Support for Anthropic, OpenAI, and compatible APIs
  - Custom endpoints per credential
  - Model mapping for heterogeneous providers
- **API Key Management**
  - SHA-256 hashed storage with KV caching
  - User-based access control
- **Usage Analytics**
  - Token usage tracking (input/output/total)
  - Time-based grouping (hour/day/week)
  - Cost analysis per model/provider
- **Admin Dashboard**
  - Real-time statistics with charts
  - Public stats page for API key holders

---

## Quick Start

### Local Development

```bash
# Clone and install
git clone https://github.com/your-org/agate.git
cd agate
npm install

# Initialize local database
npm run db:migrate:local
npm run db:seed:local

# Start all services (Proxy + Admin + Health + Pages)
pnpm dev:start
```

Services available at:
- **Proxy API:** `http://localhost:8787`
- **Admin API:** `http://localhost:8788`
- **Admin Pages:** `http://localhost:5173`

### Production Deployment

```bash
# Deploy with default workers.dev domains
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID

# Deploy with custom domains
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID --proxy-domain=api.example.com --admin-domain=admin.example.com
```

**The script automatically:**
1. Creates D1 database `agate-db` (if needed)
2. Creates KV namespace `agate-cache` (if needed)
3. Applies all database migrations
4. Deploys Proxy, Admin, and Health workers
5. Deploys Admin Frontend (Pages)
6. Generates and saves super admin API key to `.admin-api-key`

---

## Architecture

### Load Balancing Strategy

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

**Why Consistent Hash?**
- Cache-friendly: Same requests hit same provider
- Automatic failover: Unhealthy nodes are skipped
- Simple configuration: No manual weights/priorities

### Health Check Mechanism

| Config | Value |
|--------|-------|
| Schedule | `*/5 * * * *` (every 5 min) |
| Granularity | Per-credential |
| Cost | ~10 tokens/check |
| Protection | 50k tokens/day quota |

**Status Flow:** `unknown` → `healthy` / `unhealthy` (3 consecutive failures)

### Worker Split

| Worker | Purpose | Routes |
|--------|---------|--------|
| agate-proxy | High-frequency API | `/v1/*`, `/health` |
| agate-admin | Management ops | `/admin/*`, `/user/*` |
| agate-health | Cron health checks | `/cron/health-check` |

---

## API Endpoints

### Proxy API (Port 8787)

```bash
GET  /health                    # Health check
GET  /v1/models                 # List available models
POST /v1/messages               # Anthropic Messages API
```

### Admin API (Port 8788)

```bash
# API Keys
GET    /admin/keys              # List API keys
POST   /admin/keys              # Create API key
PUT    /admin/keys/:id          # Update API key
POST   /admin/keys/:id/disable  # Disable API key
POST   /admin/keys/:id/enable   # Enable API key
DELETE /admin/keys/:id          # Delete API key

# Providers
GET    /admin/providers                     # List providers
POST   /admin/providers                     # Create provider
GET    /admin/providers/:id                 # Get provider details
PUT    /admin/providers/:id                 # Update provider
DELETE /admin/providers/:id                 # Delete provider
POST   /admin/providers/:id/credentials     # Add credential
DELETE /admin/providers/credentials/:id     # Delete credential
GET    /admin/providers/health-status       # Get all health statuses
POST   /admin/providers/credentials/:id/health-check  # Manual check

# Models
GET    /admin/models                          # List models
POST   /admin/models                          # Create model
GET    /admin/models/:id                      # Get model details
PUT    /admin/models/:id                      # Update model
DELETE /admin/models/:id                      # Delete model
GET    /admin/models/:id/providers            # List model providers
POST   /admin/models/:id/providers            # Add provider to model
DELETE /admin/models/:id/providers/:providerId # Remove provider

# Statistics
GET    /admin/stats/usage                    # Usage statistics
GET    /admin/stats/tokens                   # Token usage summary
GET    /admin/stats/costs                    # Cost analysis
GET    /admin/stats/models                   # Model statistics
GET    /admin/stats/provider-models          # Provider-model stats
GET    /admin/logs                           # Query usage logs

# Users
GET    /admin/users                          # List users
POST   /admin/users                          # Create user
PUT    /admin/users/:id                      # Update user
DELETE /admin/users/:id                      # Delete user
```

### User API (Port 8788)

```bash
GET  /user/auth                   # Get current user info
GET  /user/stats/tokens           # Token usage summary
GET  /user/stats/tokens/trend     # Token usage trend
```

See [API Documentation](./docs/API.md) for complete reference.

---

## Project Structure

```
agate/
├── packages/
│   └── shared/              # Shared code between workers
│       ├── src/
│       │   ├── db/          # Database schema & queries
│       │   ├── types/       # TypeScript types
│       │   ├── utils/       # Utility functions
│       │   ├── middleware/  # Auth, logging
│       │   └── services/    # Usage service
│
├── workers/
│   ├── proxy/               # Proxy Worker (API gateway)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/proxy/   # /v1/* handlers
│   │       ├── services/    # Proxy, load balancer
│   │       └── utils/       # Consistent hash
│   │
│   ├── admin/               # Admin Worker (management)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/admin/   # /admin/* handlers
│   │       └── services/    # Usage, key management
│   │
│   └── health/              # Health Worker (cron)
│       └── src/
│           ├── index.ts
│           └── services/    # Health check logic
│
├── pages/                   # Admin Frontend (Vue 3)
│   └── src/
│       ├── views/
│       │   ├── admin/      # Admin dashboard
│       │   └── public-stats/  # Public stats page
│       └── shared/
│           ├── api/        # API clients
│           └── components/ # Shared components
│
├── tests/
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── functional/         # Functional tests
│
├── scripts/                # Deployment & utility scripts
├── docs/                   # Documentation
└── package.json
```

---

## Development

```bash
# Run tests
TEST_CLEANUP=true pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Smoke test (local)
pnpm smoke-test:local
```

### Individual Worker Commands

```bash
# Proxy Worker
cd workers/proxy
wrangler dev                # Local dev
wrangler deploy             # Deploy

# Admin Worker
cd workers/admin
wrangler dev
wrangler deploy

# Health Worker
cd workers/health
wrangler dev
wrangler deploy
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete API reference |
| [Deployment Guide](./docs/DEPLOYMENT.md) | Deployment instructions |
| [Architecture](./docs/ARCHITECTURE.md) | Architecture decisions (ADR) |
| [Functional Testing](./tests/functional/README.md) | Functional testing guide |

---

## Configuration

### Environment Variables

| Variable | Worker | Description | Default |
|----------|--------|-------------|---------|
| ENVIRONMENT | All | Environment identifier | development |
| SYSTEM_USER_ID | Health | System user for health checks | sys-health-user |

### Database

Agate uses Cloudflare D1 (SQLite) with migrations in `packages/shared/src/db/migrations/`.

---

## License

[MIT](./LICENSE) © 2025 Agate Contributors

---

## Links

- [Issues](https://github.com/your-org/agate/issues)
- [Discussions](https://github.com/your-org/agate/discussions)
