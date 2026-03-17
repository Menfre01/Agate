-- System User Initialization Script for Health Check Worker
--
-- This script creates the system user, company, and API key
-- required for the health check functionality.
--
-- Usage: npx wrangler d1 execute ai-gateway-db --local --file=scripts/seed-system-user.sql

-- Create system company for health check
INSERT INTO companies (
  id,
  name,
  quota_pool,
  quota_used,
  quota_daily,
  daily_used,
  last_reset_at,
  created_at,
  updated_at
) VALUES (
  'sys-health',
  'System Health Check',
  0,
  0,
  10000,
  0,
  1727740800000, -- 2024-10-01 00:00:00 UTC
  1727740800000,
  1727740800000
) ON CONFLICT(id) DO NOTHING;

-- Create system user for health check
INSERT INTO users (
  id,
  email,
  name,
  company_id,
  department_id,
  role,
  quota_daily,
  quota_used,
  is_active,
  last_reset_at,
  created_at,
  updated_at
) VALUES (
  'sys-health-user',
  'system@agate.internal',
  'Health Check System',
  'sys-health',
  NULL,
  'admin',
  10000,
  0,
  1,
  1727740800000,
  1727740800000,
  1727740800000
) ON CONFLICT(email) DO NOTHING;

-- Create system API key for health check
-- Generate a key hash for "sk-health-system-key" (for local development)
-- In production, use a secure random key
INSERT INTO api_keys (
  id,
  key_hash,
  key_prefix,
  user_id,
  company_id,
  department_id,
  name,
  quota_daily,
  quota_used,
  quota_bonus,
  quota_bonus_expiry,
  is_unlimited,
  is_active,
  last_reset_at,
  last_used_at,
  expires_at,
  created_at,
  updated_at
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
  NULL,
  0,
  1,
  1727740800000,
  NULL,
  NULL,
  1727740800000,
  1727740800000
) ON CONFLICT(key_hash) DO NOTHING;

-- Verify installation
SELECT 'System company created:' as status, id, name FROM companies WHERE id = 'sys-health'
UNION ALL
SELECT 'System user created:', id, email FROM users WHERE id = 'sys-health-user'
UNION ALL
SELECT 'System API key created:', id, key_prefix FROM api_keys WHERE id = 'sys-health-api-key';
