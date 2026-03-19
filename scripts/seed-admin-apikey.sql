-- AI Gateway Admin API Key Initialization
--
-- This script inserts or updates the fixed admin API key for local development.
--
-- Admin API Key: sk-admin_dev_fixed_key_local_2024
-- Hash: SHA-256 hash of the key
--
-- Usage:
--   npx wrangler d1 execute ai-gateway-db --local --file=./scripts/seed-admin-apikey.sql

-- ============================================
-- Ensure Organization Data Exists
-- ============================================

-- Insert or ignore company
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
)
ON CONFLICT(name) DO UPDATE SET
  quota_pool = 10000000,
  updated_at = strftime('%s', 'now') * 1000
WHERE name = 'Demo Company';

-- Insert or ignore department
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
)
ON CONFLICT(company_id, name) DO UPDATE SET
  quota_pool = 5000000,
  updated_at = strftime('%s', 'now') * 1000
WHERE company_id = 'co_demo_company' AND name = 'Engineering';

-- Insert or ignore admin user
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
)
ON CONFLICT(email) DO UPDATE SET
  role = 'admin',
  is_active = TRUE,
  updated_at = strftime('%s', 'now') * 1000
WHERE email = 'admin@example.com';

-- ============================================
-- Admin API Key
-- ============================================

-- Key: sk-admin_dev_fixed_key_local_2024
-- Hash: SHA-256 of the key
DELETE FROM api_keys WHERE id = 'ak_admin_key';

INSERT INTO api_keys (
  id, key_hash, key_prefix, user_id, company_id, department_id,
  name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active,
  created_at, updated_at
) VALUES (
  'ak_admin_key',
  'eb39b17d861f6e3e7a2d4c2417a6ae0154c67dbdda929ead5d5e8e1d1b96f3b6',
  'sk-admin_dev_...',
  'u_admin',
  'co_demo_company',
  'dept_engineering',
  'Local Admin Key (Fixed)',
  0,
  0,
  0,
  TRUE,
  TRUE,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- ============================================
-- Verification
-- ============================================

SELECT 'Admin API Key created/updated:' as status,
       id,
       key_prefix,
       name,
       is_unlimited,
       is_active
FROM api_keys
WHERE id = 'ak_admin_key';
