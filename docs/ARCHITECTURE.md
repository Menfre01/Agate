<div align="right">

[简体中文](./ARCHITECTURE.zh-CN.md)

</div>

# Architecture Decision Records (ADR)

## Architecture Overview

Agate is a multi-tenant AI API gateway built on Cloudflare Workers with a focus on:

1. **Two-layer consistent hash load balancing** for cache-friendly routing
2. **Automated health checks** with quota protection
3. **Multi-provider management** with model mapping
4. **Simplified user system** (API Key only, no password login)

---

## ADR-001: Consistent Hash vs Weighted Random

**Status:** Accepted
**Date:** 2026-03-22

### Decision

Use **consistent hashing** for load balancing, NOT weighted random.

### Rationale

| Factor | Consistent Hash | Weighted Random | Choice |
|--------|----------------|-----------------|--------|
| Cache-friendly | ✅ Same request → same provider | ❌ Random each time | **Consistent Hash** |
| Traffic precision | ❌ Even distribution | ✅ Precise control | — |
| Complexity | ✅ Simple | ⚠️ More complex | **Consistent Hash** |
| Failover | ✅ Auto skip unhealthy | ✅ Auto skip unhealthy | Tie |

### Why Cache-Friendly Matters

1. **LLM requests are repetitive** — Same prompts often requested multiple times
2. **Upstream providers have caches** — Anthropic, OpenAI cache responses
3. **Locking to same provider** → Maximizes cache hit rate → Lower latency & cost

### Why Precision Isn't Critical

- Credentials don't need exact traffic ratios
- Consistent hash distributes evenly enough
- Can switch to weighted random if/when Agate has its own token cache

### Implementation

```typescript
// Layer 1: Provider selection
hash(api_key_id + model_id) → provider

// Layer 2: Credential selection
hash(api_key_id) → credential
```

### Future Evolution

When Agate implements its own token cache, cache-friendliness becomes less important. At that point, consider switching to weighted random for more flexible traffic control.

---

## ADR-002: Health Check Design

**Status:** Accepted
**Date:** 2026-03-22

### Decision

1. **Credential-level checking** (not per-model)
2. **Automatic model selection** for cheapest health check
3. **System user quota protection** to prevent check storms

### Granularity: Per-Credential

| Approach | Description | Pros/Cons |
|----------|-------------|-----------|
| **Per-Credential** ✅ | Each credential checked independently | ✅ Fewer checks<br>✅ Less token usage<br>✅ Clear meaning |
| Per-Model | Every model for each credential | ❌ Too many checks<br>❌ High token cost |

**Rationale:** Health checks validate *credential validity*, not each model. Model availability is controlled via `model_providers.is_active`.

### Automatic Model Selection

Table `provider_credentials` has `health_check_model_id` field:

```sql
CREATE TABLE provider_credentials (
    ...
    health_check_model_id TEXT,  -- Auto-selected cheapest model
    ...
);
```

**Selection Strategy:**
1. Pick cheapest model from provider's active models
2. Auto-set on credential creation
3. Admin can manually override

### Minimal Check Request

```json
{
  "model": "claude-3-haiku-20240307",
  "max_tokens": 1,
  "messages": [{"role": "user", "content": "."}]
}
```

**Cost:** ~10 tokens per check (9 input + 1 output)

### System User Quota Protection

Virtual system user with daily quota limit:

```sql
INSERT INTO users (id, email, name, role, quota_daily, quota_used)
VALUES (
    'sys-health-user',
    'system@agate.internal',
    'Health Check System',
    'system',
    50000,    -- ~50k tokens/day for ~17 credentials
    0
);
```

**Protection Layers:**

| Layer | Limit | Action |
|-------|-------|--------|
| Daily quota | 50k tokens/day | Stop checking, alert |
| Per-check | 100 tokens | Abort if exceeded |
| Warning | >80% used | Log warning |

**Formula:** `quota_daily / (288 × 10) = max_credentials`
- 288 checks/day = 24 × 12 (every 5 min)
- ~10 tokens per check
- 50,000 / 2,880 ≈ 17 credentials

### Status Transitions

```
unknown → healthy: First success
unknown → unhealthy: First failure
healthy → unhealthy: 3+ consecutive failures
unhealthy → healthy: Success (reset counter)
```

---

## ADR-003: Model Mapping at ModelProviders Level

**Status:** Accepted
**Date:** 2026-03-22

### Decision

Put `actual_model_id` in `model_providers` table, NOT `models` table.

### Options

| Option | Location | Issue |
|--------|----------|-------|
| A | `models` table | Can't handle different API formats |
| B ✅ | `model_providers` table | Flexible per-provider mapping |

### Why ModelProviders?

1. **Different providers = Different APIs**
   - Anthropic: `claude-3-sonnet`
   - Zhipu: `glm-4`
   - DeepSeek: `deepseek-chat`

2. **Need per-provider configuration**
   - Different parameters
   - Different response formats
   - Different pricing

### Example Mapping

| model_id | provider_id | actual_model_id |
|----------|-------------|-----------------|
| claude-3-sonnet | anthropic | NULL (use as-is) |
| claude-3-sonnet | zhipu | glm-4 |
| claude-3-sonnet | deepseek | deepseek-chat |

### Request Flow

```
User requests: claude-3-sonnet
       ↓
Query model_providers for this model
       ↓
Consistent hash → select provider
       ↓
Use actual_model_id if set, else model_id
       ↓
Call upstream API
```

---

## ADR-004: Simplified User System (Phase 1)

**Status:** Accepted
**Date:** 2026-03-24

### Decision

Phase 1 uses simplified user system:

```
User → API Key
```

**NOT:**
```
Organization → Department → User → API Key
```

### What's Different from V1

| Aspect | Phase 1 | Phase 2 (Future) |
|--------|---------|------------------|
| Authentication | API Key only | API Key + Password? |
| Organization | Tables exist, unused | Full hierarchy |
| Quota | Fields exist, unused | Active enforcement |
| User creation | Manual via Admin API | Self-registration? |

### Implementation Notes

1. **API Key only** — No password login in Phase 1
2. **Organization tables reserved** — `companies`, `departments` exist in DB but code doesn't use them
3. **Quota fields reserved** — `quota_daily`, `quota_used` exist but only system user uses them
4. **Clean separation** — Code doesn't depend on org hierarchy, keeps Phase 1 simple

### System User

Special `role='system'` user for health checks:

```sql
INSERT INTO users (
    id, email, name, role,
    quota_daily, quota_used, is_active
) VALUES (
    'sys-health-user',
    'system@agate.internal',
    'Health Check System',
    'system',
    50000, 0, TRUE
);
```

**Purpose:**
- Track health check token consumption
- Enable quota protection
- Separate system from user traffic

---

## Worker Split Architecture

### Why Split Workers?

| Concern | Split | Monolithic |
|---------|-------|------------|
| Performance | ✅ Optimize each independently | ❌ One size fits all |
| Deployment | ✅ Update admin without touching proxy | ❌ Risk everything |
| Routing | ✅ Separate domains | ❌ Single domain |
| Complexity | ⚠️ More config | ✅ Simpler |

**Decision:** Split for production-grade reliability.

### Worker Responsibilities

| Worker | Name | Purpose | Routes |
|--------|------|---------|--------|
| Proxy | agate-proxy | High-frequency API | `/v1/*`, `/health` |
| Admin | agate-admin | Management | `/admin/*`, `/user/*` |
| Health | agate-health | Cron checks | `/cron/health-check` |

### Shared Resources

All workers share:
- **D1 Database:** `agate-db` (usage_logs, api_keys, providers, etc.)
- **KV Cache:** `agate-cache` (API key auth cache)

### Production Domains

```
Proxy:  https://api.yourdomain.com  → agate-proxy
Admin:  https://admin.yourdomain.com → agate-admin
Pages:  https://admin.yourdomain.com → agate-admin (serves frontend)
```

---

## Two-Layer Load Balancing

### Layer 1: Provider Selection

```
hash(api_key_id + model_id) → provider
```

**Ensures:** Same user + same model = same provider (cache-friendly)

### Layer 2: Credential Selection

```
hash(api_key_id) → credential
```

**Ensures:** Same user = same credential (further cache hits)

### Failover Logic

```
For each provider in hash order:
    Skip if !is_active
    For each credential in hash order:
        Skip if health_status != 'healthy'
        Try upstream API
        If success: return response
        If failure: continue to next
```

### Diagram

```
┌─────────────────┐
│ User Request    │
│ model: claude-3 │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Layer 1: Provider Selection     │
│ hash(api_key_id + model_id)     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Layer 2: Credential Selection   │
│ hash(api_key_id)                │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Upstream API                    │
│ base_url + api_key              │
└─────────────────────────────────┘
```
