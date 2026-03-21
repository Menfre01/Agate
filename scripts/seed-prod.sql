-- AI Gateway Production Seed Data
--
-- This script inserts minimal data required for production.
-- Run after schema.sql:
--   wrangler d1 execute agate-db --file=./packages/shared/src/db/schema.sql --config wrangler.prod.jsonc
--   wrangler d1 execute agate-db --file=./scripts/seed-prod.sql --config wrangler.prod.jsonc
--
-- For production deployment with quick-deploy.sh

-- ============================================
-- System User (Required for Health Check Worker)
-- ============================================

-- System company for health check
INSERT INTO companies (id, name, quota_pool, quota_used, quota_daily, daily_used, last_reset_at, created_at, updated_at)
VALUES (
  'sys-health',
  'System Health Check',
  0,
  0,
  10000,
  0,
  1727740800000,
  1727740800000,
  1727740800000
) ON CONFLICT(id) DO NOTHING;

-- System user for health check
INSERT INTO users (id, email, name, company_id, department_id, role, quota_daily, quota_used, is_active, last_reset_at, created_at, updated_at)
VALUES (
  'sys-health-user',
  'system@agate.internal',
  'Health Check System',
  'sys-health',
  NULL,
  'admin',
  10000,
  0,
  TRUE,
  1727740800000,
  1727740800000,
  1727740800000
) ON CONFLICT(email) DO NOTHING;

-- System API key for health check
INSERT INTO api_keys (
  id, key_hash, key_prefix, user_id, company_id, department_id,
  name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active,
  created_at, updated_at
) VALUES (
  'sys-health-api-key',
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'sk-health-****',
  'sys-health-user',
  'sys-health',
  NULL,
  'System Health Check API Key',
  10000,
  0,
  0,
  FALSE,
  TRUE,
  1727740800000,
  1727740800000
) ON CONFLICT(key_hash) DO NOTHING;

-- ============================================
-- Admin User and Company (for Super Admin API Key)
-- ============================================

-- Demo company for admin
INSERT INTO companies (id, name, quota_pool, quota_used, quota_daily, daily_used, last_reset_at, created_at, updated_at)
VALUES (
  'co_demo_company',
  'Demo Company',
  0,
  0,
  1000000,
  0,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
) ON CONFLICT(id) DO NOTHING;

-- Engineering department
INSERT INTO departments (id, name, company_id, quota_pool, quota_used, created_at, updated_at)
VALUES (
  'dept_engineering',
  'Engineering',
  'co_demo_company',
  0,
  0,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
) ON CONFLICT(id) DO NOTHING;

-- Admin user
INSERT INTO users (id, email, name, company_id, department_id, role, quota_daily, quota_used, is_active, last_reset_at, created_at, updated_at)
VALUES (
  'u_admin',
  'admin@agate.internal',
  'Super Admin',
  'co_demo_company',
  'dept_engineering',
  'admin',
  1000000,
  0,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
) ON CONFLICT(email) DO NOTHING;

-- ============================================
-- Providers (Anthropic)
-- ============================================

INSERT INTO providers (id, name, display_name, base_url, api_version, is_active, created_at, updated_at)
VALUES (
  'p_anthropic',
  'anthropic',
  'Anthropic',
  'https://api.anthropic.com',
  'v1',
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
) ON CONFLICT(id) DO NOTHING;

-- ============================================
-- Models (Claude Series)
-- ============================================
-- Source: https://platform.claude.com/docs/en/about-claude/models/overview
-- Updated: 2026-03-18

INSERT INTO models (id, model_id, display_name, context_window, max_tokens, is_active, created_at, updated_at)
VALUES
  ('m_claude_opus_4_6', 'claude-opus-4-6', 'Claude Opus 4.6', 1000000, 128000, TRUE, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('m_claude_sonnet_4_6', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 1000000, 64000, TRUE, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('m_claude_haiku_4_5_20251001', 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 200000, 64000, TRUE, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
ON CONFLICT(id) DO NOTHING;

-- ============================================
-- Model Providers (with pricing)
-- ============================================

INSERT INTO model_providers (id, model_id, provider_id, input_price, output_price, is_active, created_at, updated_at)
VALUES
  ('mp_claude_opus_4_6_anthropic', 'm_claude_opus_4_6', 'p_anthropic', 5.0, 25.0, TRUE, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('mp_claude_sonnet_4_6_anthropic', 'm_claude_sonnet_4_6', 'p_anthropic', 3.0, 15.0, TRUE, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('mp_claude_haiku_4_5_anthropic', 'm_claude_haiku_4_5_20251001', 'p_anthropic', 1.0, 5.0, TRUE, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
ON CONFLICT(id) DO NOTHING;

-- ============================================
-- Summary
-- ============================================

-- Production seed data inserted:
-- - 1 system user (for health check)
-- - 1 system API key (for health check)
-- - 1 provider (Anthropic)
-- - 3 models (Claude Opus 4.6, Sonnet 4.6, Haiku 4.5) with pricing
--
-- Note: Admin user and API key will be created by init-admin-key.js
