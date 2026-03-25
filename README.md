<div align="right">

[中文](./README.zh-CN.md)

</div>

# Agate

<div align="center">

**Your AI Gateway — One Hub for All LLMs**

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

[Features](#-features) · [Quick Start](#-quick-start) · [Documentation](#-documentation) · [Contributing](#-contributing)

</div>

---

Agate is a high-performance AI API gateway built on Cloudflare Workers with two-layer consistent hash load balancing, automated health checks, and multi-provider management.

---

## ✨ Features

- **🔀 Two-Layer Consistent Hash LB** — Routes same model requests to same provider for cache optimization
- **⚡ Automated Health Checks** — Cron-triggered every 5 minutes with quota protection (~10 tokens/check)
- **🔄 Multi-Provider Management** — Support for Anthropic, OpenAI, and compatible APIs with model mapping
- **🗝️ API Key Authentication** — SHA-256 hashed storage with KV caching
- **💰 Usage Analytics** — Token tracking, cost analysis, and time-based statistics
- **🎨 Admin Dashboard** — Real-time stats with Vue 3
- **🧱 Worker Split Architecture** — Separate Proxy, Admin, and Health workers for optimal performance

---

## 🚀 Quick Start

### Local Development

```bash
# Clone and install
git clone https://github.com/your-org/agate.git
cd agate
npm install

# Initialize local database
npm run db:migrate:local
npm run db:seed:local

# Start all services
pnpm dev:start
```

**Services:**
| Service | URL |
|---------|-----|
| Proxy API | `http://localhost:8787` |
| Admin API | `http://localhost:8788` |
| Admin Dashboard | `http://localhost:5173` |

### Production Deployment

```bash
# Deploy with default workers.dev domains
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID

# Deploy with custom domains
./scripts/quick-deploy.sh --account-id=YOUR_ACCOUNT_ID \
  --proxy-domain=api.example.com \
  --admin-domain=admin.example.com
```

**The script automatically:**
1. Creates D1 database `agate-db` and KV namespace `agate-cache`
2. Applies database migrations
3. Deploys Proxy, Admin, and Health workers
4. Deploys Admin Frontend (Pages)
5. Generates super admin API key (saved to `.admin-api-key`)

---

## 📸 Screenshots

### Admin Dashboard

| Dashboard | Logs |
|----------|------|
| *[Dashboard screenshot placeholder]* | *[Logs screenshot placeholder]* |

---

## 🏗️ Architecture

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
- ✅ Cache-friendly: Same requests hit same provider
- ✅ Automatic failover: Unhealthy nodes are skipped
- ✅ Simple configuration: No manual weights/priorities

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
| agate-admin | Management operations | `/admin/*`, `/user/*` |
| agate-health | Cron health checks | `/cron/health-check` |

---

## 🔌 API Endpoints

### Proxy API

```bash
GET  /health           # Health check
GET  /v1/models        # List available models
POST /v1/messages      # Anthropic Messages API
```

### Admin API

```bash
# API Keys
GET    /admin/keys             # List API keys
POST   /admin/keys             # Create API key
PUT    /admin/keys/:id         # Update API key
DELETE /admin/keys/:id         # Delete API key

# Providers
GET    /admin/providers                    # List providers
POST   /admin/providers                    # Create provider
DELETE /admin/providers/:id                # Delete provider
POST   /admin/providers/:id/credentials    # Add credential
GET    /admin/providers/health-status      # Get health statuses

# Statistics
GET  /admin/stats/usage           # Usage statistics
GET  /admin/stats/tokens          # Token usage summary
GET  /admin/stats/costs           # Cost analysis
GET  /admin/logs                  # Query usage logs
```

See [API Documentation](./docs/API.md) for complete reference.

---

## 💻 Client Integration

### cURL

```bash
curl https://api.example.com/v1/messages \
  -H "x-api-key: your-api-key" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Python (Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://api.example.com",
    api_key="your-api-key"
)

message = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### JavaScript / TypeScript

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'https://api.example.com',
  apiKey: 'your-api-key',
});

const message = await client.messages.create({
  model: 'claude-3-sonnet-20240229',
  maxTokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete API reference |
| [Deployment Guide](./docs/DEPLOYMENT.md) | Deployment instructions |
| [Architecture](./docs/ARCHITECTURE.md) | Architecture decisions (ADR) |
| [Functional Testing](./tests/functional/README.md) | Functional testing guide |

---

## 🛠️ Development

```bash
# Run tests (with cleanup)
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
wrangler dev    # Local dev
wrangler deploy # Deploy

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

## 📂 Project Structure

```
agate/
├── packages/shared/        # Shared code between workers
│   └── src/
│       ├── db/            # Database schema & queries
│       ├── types/         # TypeScript types
│       ├── utils/         # Utility functions
│       ├── middleware/    # Auth, logging
│       └── services/      # Usage service
│
├── workers/
│   ├── proxy/             # Proxy Worker (API gateway)
│   ├── admin/             # Admin Worker (management)
│   └── health/            # Health Worker (cron)
│
├── pages/                 # Admin Frontend (Vue 3)
├── tests/                 # Unit, integration, functional tests
├── scripts/               # Deployment & utility scripts
└── docs/                  # Documentation
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Worker | Description | Default |
|----------|--------|-------------|---------|
| ENVIRONMENT | All | Environment identifier | development |
| SYSTEM_USER_ID | Health | System user for health checks | sys-health-user |

### Database

Agate uses Cloudflare D1 (SQLite). Migrations are in `packages/shared/src/db/migrations/`.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

[MIT](./LICENSE) © 2025 Agate Contributors

---

## 🔗 Links

- [Issues](https://github.com/your-org/agate/issues)
- [Discussions](https://github.com/your-org/agate/discussions)
- [Changelog](./CHANGELOG.md)
