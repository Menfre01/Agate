<div align="right">

[中文](./README.zh-CN.md)

</div>

# Agate — Your AI Gateway

A multi-tenant AI API gateway built on Cloudflare Workers with provider management, model management, API key management, and quota analytics.

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [License](#license)

---

## Features

- **Multi-tenant Architecture** — Company, department, and user hierarchy with isolated quotas
- **Provider Management** — Support for multiple AI providers with custom endpoints
- **Model Management** — Unified model catalog with provider linking
- **API Key Management** — Granular key management with quota controls
- **Usage Analytics** — Token usage, cost analysis, and request logging
- **Quota System** — Daily quotas and quota pools with auto-reset

---

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Initialize local database
npm run db:migrate:local
npm run db:seed:local

# Start dev server
npm run dev
```

Service available at `http://localhost:8787`

### Production Deployment

```bash
# Quick deploy (auto-creates resources)
./scripts/quick-deploy.sh

# With custom domain
./scripts/quick-deploy.sh ai.yourdomain.com

# With specific account_id
./scripts/quick-deploy.sh "" your-account-id
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete API reference |
| [Deployment Guide](./docs/DEPLOYMENT.md) | Deployment instructions |
| [E2E Testing](./tests/e2e/README.md) | End-to-end testing guide |

---

## API Endpoints

### Proxy API

```bash
# List models
GET /v1/models

# Send message (Anthropic-compatible)
POST /v1/messages
```

### Admin API (Requires Admin Key)

```bash
# API Keys
GET    /admin/keys
POST   /admin/keys
DELETE /admin/keys/:id

# Providers
GET    /admin/providers
POST   /admin/providers

# Models
GET    /admin/models
POST   /admin/models

# Statistics
GET    /admin/stats/usage
GET    /admin/stats/tokens
```

See [API Documentation](./docs/API.md) for complete reference

---

## Project Structure

```
src/
├── api/           # Route handlers
│   ├── admin/     # Admin endpoints
│   └── proxy/     # Proxy endpoints
├── db/            # Database schema & queries
├── middleware/    # Auth, rate limit, logging
├── services/      # Business logic services
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

---

## Development

```bash
# Run tests
npm test

# Type check
npm run typecheck

# E2E tests
./tests/e2e/run.sh
```

---

## License

MIT

---

## Deployment Documentation

- [Deployment Guide](./docs/DEPLOYMENT.md)
