-- AI Gateway Seed Data
--
-- This script inserts initial data for development/testing.
-- Run after schema.sql:
--   wrangler d1 execute ai-gateway-db --file=./src/db/schema.sql --local
--   wrangler d1 execute ai-gateway-db --file=./scripts/seed-data.sql --local

-- ============================================
-- Organizations
-- ============================================

-- Default company
INSERT INTO companies (id, name, quota_pool, quota_used, quota_daily, daily_used, last_reset_at, created_at, updated_at)
VALUES (
  'co_demo_company',
  'Demo Company',
  10000000,  -- 10M tokens
  0,
  100000,   -- 100K daily
  0,
  NULL,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- Default department
INSERT INTO departments (id, company_id, name, quota_pool, quota_used, quota_daily, daily_used, last_reset_at, created_at, updated_at)
VALUES (
  'dept_engineering',
  'co_demo_company',
  'Engineering',
  5000000,  -- 5M tokens
  0,
  50000,    -- 50K daily
  0,
  NULL,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- Admin user
INSERT INTO users (id, email, name, company_id, department_id, role, quota_daily, quota_used, is_active, created_at, updated_at)
VALUES (
  'u_admin',
  'admin@example.com',
  'Admin User',
  'co_demo_company',
  'dept_engineering',
  'admin',
  0,
  0,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- Demo user
INSERT INTO users (id, email, name, company_id, department_id, role, quota_daily, quota_used, is_active, created_at, updated_at)
VALUES (
  'u_demo_user',
  'user@example.com',
  'Demo User',
  'co_demo_company',
  'dept_engineering',
  'user',
  10000,    -- 10K daily
  0,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- ============================================
-- API Keys
-- ============================================

-- Note: These are example hashes. In production, generate real hashes
-- using the KeyService. The prefix is what users see.

-- Admin API key (unlimited) - Fixed local development key
-- Key: sk-admin_dev_fixed_key_local_2024
-- Hash: SHA-256 of the key
INSERT INTO api_keys (
  id, key_hash, key_prefix, user_id, company_id, department_id,
  name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active,
  created_at, updated_at
) VALUES (
  'ak_admin_key',
  'eb39b17d861f6e3e7a2d4c2417a6ae0154c67dbdda929ead5d5e8e1d1b96f3b6',
  'sk-admin_...',
  'u_admin',
  'co_demo_company',
  'dept_engineering',
  'Local Admin Key',
  0,
  0,
  0,
  TRUE,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- Demo user API key
INSERT INTO api_keys (
  id, key_hash, key_prefix, user_id, company_id, department_id,
  name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active,
  created_at, updated_at
) VALUES (
  'ak_demo_key',
  '$2a$10$demo_placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',  -- Placeholder - replace with real hash
  'sk_demo_',
  'u_demo_user',
  'co_demo_company',
  'dept_engineering',
  'Demo Key',
  10000,
  0,
  0,
  FALSE,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- ============================================
-- Providers
-- ============================================

-- Anthropic provider
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
);

-- ============================================
-- Models
-- ============================================

-- Claude 4 Opus
INSERT INTO models (id, model_id, display_name, provider_id, input_price, output_price, context_window, max_tokens, is_active, created_at, updated_at)
VALUES (
  'm_claude_4_opus',
  'claude-4-opus-20250114',
  'Claude 4 Opus',
  'p_anthropic',
  15.0,   -- $15 per million input tokens
  75.0,   -- $75 per million output tokens
  200000,
  8192,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- Claude 4 Sonnet
INSERT INTO models (id, model_id, display_name, provider_id, input_price, output_price, context_window, max_tokens, is_active, created_at, updated_at)
VALUES (
  'm_claude_4_sonnet',
  'claude-4-sonnet-20250114',
  'Claude 4 Sonnet',
  'p_anthropic',
  3.0,    -- $3 per million input tokens
  15.0,   -- $15 per million output tokens
  200000,
  8192,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- Claude 3.5 Sonnet
INSERT INTO models (id, model_id, display_name, provider_id, input_price, output_price, context_window, max_tokens, is_active, created_at, updated_at)
VALUES (
  'm_claude_3_5_sonnet',
  'claude-3-5-sonnet-20241022',
  'Claude 3.5 Sonnet',
  'p_anthropic',
  3.0,    -- $3 per million input tokens
  15.0,   -- $15 per million output tokens
  200000,
  8192,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- Claude 3 Haiku
INSERT INTO models (id, model_id, display_name, provider_id, input_price, output_price, context_window, max_tokens, is_active, created_at, updated_at)
VALUES (
  'm_claude_3_haiku',
  'claude-3-haiku-20240307',
  'Claude 3 Haiku',
  'p_anthropic',
  0.25,   -- $0.25 per million input tokens
  1.25,   -- $1.25 per million output tokens
  200000,
  4096,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- ============================================
-- Department Models (Allow)
-- ============================================

-- Allow Engineering to use all models
INSERT INTO department_models (id, department_id, model_id, is_allowed, daily_quota, created_at)
VALUES
  ('dm_eng_claude_4_opus', 'dept_engineering', 'm_claude_4_opus', TRUE, 0, strftime('%s', 'now') * 1000),
  ('dm_eng_claude_4_sonnet', 'dept_engineering', 'm_claude_4_sonnet', TRUE, 0, strftime('%s', 'now') * 1000),
  ('dm_eng_claude_3_5_sonnet', 'dept_engineering', 'm_claude_3_5_sonnet', TRUE, 0, strftime('%s', 'now') * 1000),
  ('dm_eng_claude_3_haiku', 'dept_engineering', 'm_claude_3_haiku', TRUE, 0, strftime('%s', 'now') * 1000);

-- ============================================
-- Usage Summary
-- ============================================

-- Seed data inserted:
-- - 1 company (Demo Company)
-- - 1 department (Engineering)
-- - 2 users (Admin, Demo User)
-- - 2 API keys
-- - 1 provider (Anthropic)
-- - 4 models (Claude 4 Opus, Sonnet, 3.5 Sonnet, 3 Haiku) with pricing
-- - 4 department-model permissions
