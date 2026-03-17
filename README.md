<div align="right">

[中文](./README.zh-CN.md)

</div>

# Agate — Your AI Gateway

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)

A multi-tenant AI API gateway built on Cloudflare Workers with provider management, model management, API key management, and quota analytics.

**Architecture:** Split-worker design for optimal performance
- **Proxy Worker** — High-frequency API requests (`/v1/*`)
- **Admin Worker** — Management operations (`/admin/*`)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [License](#license)

---

## Features

- **Split-Worker Architecture** — Proxy and Admin workers for optimized performance
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

# Start dev servers (both Proxy and Admin)
npm run dev
```

Services available at:
- **Proxy API:** `http://localhost:8787`
- **Admin API:** `http://localhost:8788`

### Production Deployment

```bash
# Quick deploy (auto-creates resources for both workers)
./scripts/quick-deploy.sh

# With custom domains
./scripts/quick-deploy.sh api.yourdomain.com admin.yourdomain.com

# With specific account_id
./scripts/quick-deploy.sh "" "" your-account-id
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete API reference |
| [Deployment Guide](./docs/DEPLOYMENT.md) | Deployment instructions |
| [E2E Testing](./tests/e2e/README.md) | End-to-end testing guide |
| [Functional Testing](./tests/functional/README.md) | Functional testing guide |

---

## API Endpoints

### Proxy API (Proxy Worker — Port 8787)

```bash
# Health check
GET /health

# List models
GET /v1/models

# Send message (Anthropic-compatible)
POST /v1/messages
```

### Admin API (Admin Worker — Port 8788)

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
agate/
├── packages/
│   └── shared/          # Shared code between workers
│       ├── src/
│       │   ├── db/      # Database schema & queries
│       │   ├── types/   # TypeScript types
│       │   ├── utils/   # Utility functions
│       │   ├── middleware/  # Auth, rate limit, logging
│       │   └── services/    # Shared services (cache, etc.)
│       └── package.json
│
├── workers/
│   ├── proxy/           # Proxy Worker (high-frequency API)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/proxy/
│   │       ├── middleware/
│   │       └── services/
│   │   ├── wrangler.jsonc
│   │   └── wrangler.prod.jsonc
│   │
│   └── admin/           # Admin Worker (management operations)
│       └── src/
│           ├── index.ts
│           ├── api/admin/
│           ├── middleware/
│           └── services/
│       ├── wrangler.jsonc
│       └── wrangler.prod.jsonc
│
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   ├── functional/      # Functional tests
│   └── e2e/            # End-to-end tests
│
├── scripts/             # Deployment and utility scripts
├── docs/                # Documentation
└── package.json         # Root package (workspaces)
```

---

## Development

```bash
# Run tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:functional

# Type check
npm run typecheck

# Run smoke test
npm run smoke-test:local
```

### Individual Worker Commands

```bash
# Start only Proxy Worker
npm run dev:proxy

# Start only Admin Worker
npm run dev:admin

# Deploy only Proxy Worker
npm run deploy:proxy

# Deploy only Admin Worker
npm run deploy:admin
```

---

## License

[MIT](./LICENSE) © 2025 Agate Contributors

---

## Deployment Documentation

- [Deployment Guide](./docs/DEPLOYMENT.md)
