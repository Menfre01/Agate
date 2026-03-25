# Architecture Decision Records (ADR)

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## Architecture Overview

Agate V2 is a multi-tenant AI API gateway built on Cloudflare Workers with a focus on:

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

---

<a name="简体中文"></a>
## 架构决策记录 (ADR)

## 架构概览

Agate V2 是基于 Cloudflare Workers 的多租户 AI API 网关，专注于：

1. **两层一致性哈希负载均衡** — 缓存友好的路由
2. **自动化健康检查** — 配额保护机制
3. **多供应商管理** — 模型映射支持
4. **简化用户系统** — 仅 API Key 认证，无密码登录

---

## ADR-001: 一致性哈希 vs 加权随机

**状态：** 已接受
**日期：** 2026-03-22

### 决策

使用**一致性哈希**进行负载均衡，不使用加权随机。

### 理由

| 因素 | 一致性哈希 | 加权随机 | 选择 |
|------|-----------|----------|------|
| 缓存友好 | ✅ 同一请求→同一供应商 | ❌ 每次随机 | **一致性哈希** |
| 流量精度 | ❌ 均匀分布 | ✅ 精确控制 | — |
| 复杂度 | ✅ 简单 | ⚠️ 较复杂 | **一致性哈希** |
| 故障切换 | ✅ 自动跳过不健康 | ✅ 自动跳过不健康 | 平局 |

### 缓存友好的重要性

1. **LLM 请求具有重复性** — 相同 prompt 经常被多次请求
2. **上游供应商有缓存** — Anthropic、OpenAI 都缓存响应
3. **锁定同一供应商** → 最大化缓存命中率 → 降低延迟和成本

### 为什么精度不重要

- 凭证之间不需要精确的流量分配比例
- 一致性哈希已经足够均匀
- 当 Agate 有自己的 token 缓存时，可考虑切换到加权随机

### 实现

```typescript
// 第一层：供应商选择
hash(api_key_id + model_id) → provider

// 第二层：凭证选择
hash(api_key_id) → credential
```

---

## ADR-002: 健康检查设计

**状态：** 已接受
**日期：** 2026-03-22

### 决策

1. **按凭证检查**（而非按模型）
2. **自动选择最便宜的检查模型**
3. **系统用户配额保护**防止检查风暴

### 检查粒度

| 方案 | 描述 | 优缺点 |
|------|------|--------|
| **按凭证** ✅ | 每个凭证独立检查 | ✅ 检查次数少<br>✅ Token 消耗低 |
| 按模型 | 每个凭证的每个模型都检查 | ❌ 检查次数多<br>❌ Token 消耗高 |

### 自动模型选择

`provider_credentials` 表的 `health_check_model_id` 字段：

```sql
CREATE TABLE provider_credentials (
    ...
    health_check_model_id TEXT,  -- 自动选择最便宜的模型
    ...
);
```

**选择策略：**
1. 从供应商的活跃模型中选择最便宜的
2. 创建凭证时自动设置
3. 管理员可手动覆盖

### 极简检查请求

```json
{
  "model": "claude-3-haiku-20240307",
  "max_tokens": 1,
  "messages": [{"role": "user", "content": "."}]
}
```

**成本：** 每次检查约 10 tokens（9 输入 + 1 输出）

### 系统用户配额保护

```sql
INSERT INTO users (id, email, name, role, quota_daily, quota_used)
VALUES (
    'sys-health-user',
    'system@agate.internal',
    'Health Check System',
    'system',
    50000,    -- 约 17 个凭证
    0
);
```

**保护层级：**

| 层级 | 限制 | 动作 |
|------|------|------|
| 日配额 | 50k tokens/天 | 停止检查，告警 |
| 单次检查 | 100 tokens | 超限则中断 |
| 警告 | 已用 >80% | 记录警告日志 |

---

## ADR-003: ModelProviders 级别的模型映射

**状态：** 已接受
**日期：** 2026-03-22

### 决策

将 `actual_model_id` 放在 `model_providers` 表，而非 `models` 表。

### 方案对比

| 方案 | 位置 | 问题 |
|------|------|------|
| A | `models` 表 | 无法处理不同 API 格式 |
| B ✅ | `model_providers` 表 | 灵活的每供应商映射 |

### 为什么选 ModelProviders？

1. **不同供应商 = 不同 API**
   - Anthropic: `claude-3-sonnet`
   - 智谱: `glm-4`
   - DeepSeek: `deepseek-chat`

2. **需要每供应商独立配置**
   - 不同参数
   - 不同响应格式
   - 不同定价

---

## ADR-004: 简化用户系统（第一期）

**状态：** 已接受
**日期：** 2026-03-24

### 决策

第一期使用简化用户系统：

```
用户 → API Key
```

**暂不实现：**
```
组织 → 部门 → 用户 → API Key
```

### 与 V1 的区别

| 方面 | 第一期 | 第二期（未来） |
|------|--------|----------------|
| 认证方式 | 仅 API Key | API Key + 密码？ |
| 组织架构 | 表存在但未使用 | 完整层级 |
| 配额 | 字段存在但未使用 | 活跃执行 |
| 用户创建 | 通过 Admin API 手动创建 | 自注册？ |

### 实现说明

1. **仅 API Key 认证** — 第一期无密码登录
2. **组织架构表保留** — `companies`, `departments` 存在但代码不使用
3. **配额字段保留** — `quota_daily`, `quota_used` 存在但仅系统用户使用
4. **清晰分离** — 代码不依赖组织层级，保持第一期简洁

---

## Worker 分离架构

### 为什么分离 Worker？

| 关注点 | 分离 | 单体 |
|--------|------|------|
| 性能 | ✅ 独立优化 | ❌ 一刀切 |
| 部署 | ✅ 独立更新 | ❌ 风险集中 |
| 路由 | ✅ 独立域名 | ❌ 单域名 |

### Worker 职责

| Worker | 名称 | 用途 | 路由 |
|--------|------|------|------|
| Proxy | agate-proxy | 高频 API | `/v1/*`, `/health` |
| Admin | agate-admin | 管理操作 | `/admin/*`, `/user/*` |
| Health | agate-health | Cron 检查 | `/cron/health-check` |

### 共享资源

所有 Worker 共享：
- **D1 数据库：** `agate-db`
- **KV 缓存：** `agate-cache`

---

## 两层负载均衡

### 第一层：供应商选择

```
hash(api_key_id + model_id) → provider
```

**确保：** 同一用户 + 同一模型 = 同一供应商（缓存友好）

### 第二层：凭证选择

```
hash(api_key_id) → credential
```

**确保：** 同一用户 = 同一凭证（进一步缓存命中）

### 故障切换逻辑

```
对哈希顺序中的每个供应商：
    跳过如果 !is_active
    对哈希顺序中的每个凭证：
        跳过如果 health_status != 'healthy'
        尝试上游 API
        如果成功：返回响应
        如果失败：继续下一个
```
