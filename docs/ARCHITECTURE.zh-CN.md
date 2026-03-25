<div align="right">

[English](./ARCHITECTURE.md)

</div>

# 架构决策记录 (ADR)

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

### 未来演进

当 Agate 实现自己的 token 缓存时，缓存友好性变得不再重要。此时可考虑切换到加权随机以获得更灵活的流量控制。

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
| **按凭证** ✅ | 每个凭证独立检查 | ✅ 检查次数少<br>✅ Token 消耗低<br>✅ 含义明确 |
| 按模型 | 每个凭证的每个模型都检查 | ❌ 检查次数多<br>❌ Token 消耗高 |

**理由：** 健康检查验证*凭证有效性*，而非每个模型。模型可用性通过 `model_providers.is_active` 控制。

### 自动模型选择

表 `provider_credentials` 有 `health_check_model_id` 字段：

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

虚拟系统用户具有每日配额限制：

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

**公式：** `quota_daily / (288 × 10) = max_credentials`
- 288 次检查/天 = 24 × 12（每 5 分钟）
- 每次检查约 10 tokens
- 50,000 / 2,880 ≈ 17 个凭证

### 状态流转

```
unknown → healthy: 首次成功
unknown → unhealthy: 首次失败
healthy → unhealthy: 连续 3 次失败
unhealthy → healthy: 成功（重置计数器）
```

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

### 示例映射

| model_id | provider_id | actual_model_id |
|----------|-------------|-----------------|
| claude-3-sonnet | anthropic | NULL (原样使用) |
| claude-3-sonnet | zhipu | glm-4 |
| claude-3-sonnet | deepseek | deepseek-chat |

### 请求流程

```
用户请求: claude-3-sonnet
       ↓
查询 model_providers 获取此模型的供应商
       ↓
一致性哈希 → 选择供应商
       ↓
使用 actual_model_id（如果设置），否则使用 model_id
       ↓
调用上游 API
```

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

### 系统用户

特殊 `role='system'` 用户用于健康检查：

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

**用途：**
- 跟踪健康检查 token 消耗
- 启用配额保护
- 分离系统与用户流量

---

## Worker 分离架构

### 为什么分离 Worker？

| 关注点 | 分离 | 单体 |
|--------|------|------|
| 性能 | ✅ 独立优化 | ❌ 一刀切 |
| 部署 | ✅ 独立更新 | ❌ 风险集中 |
| 路由 | ✅ 独立域名 | ❌ 单域名 |
| 复杂度 | ⚠️ 更多配置 | ✅ 更简单 |

**决策：** 分离以实现生产级可靠性。

### Worker 职责

| Worker | 名称 | 用途 | 路由 |
|--------|------|------|------|
| Proxy | agate-proxy | 高频 API | `/v1/*`, `/health` |
| Admin | agate-admin | 管理操作 | `/admin/*`, `/user/*` |
| Health | agate-health | Cron 检查 | `/cron/health-check` |

### 共享资源

所有 Worker 共享：
- **D1 数据库：** `agate-db`（usage_logs、api_keys、providers 等）
- **KV 缓存：** `agate-cache`（API Key 认证缓存）

### 生产域名

```
Proxy:  https://api.yourdomain.com  → agate-proxy
Admin:  https://admin.yourdomain.com → agate-admin
Pages:  https://admin.yourdomain.com → agate-admin（提供前端）
```

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

### 图示

```
┌─────────────────┐
│ 用户请求        │
│ model: claude-3 │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 第一层：供应商选择              │
│ hash(api_key_id + model_id)     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 第二层：凭证选择                │
│ hash(api_key_id)                │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 上游 API                        │
│ base_url + api_key              │
└─────────────────────────────────┘
```
