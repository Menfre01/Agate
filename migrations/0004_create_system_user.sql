-- Migration 0004: Create system company and user for health check (PRD V2 Section 2.4.3)

-- First, create the system company (required for user's foreign key)
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
    50000,
    0,
    (strftime('%s', 'now') * 1000),
    (strftime('%s', 'now') * 1000),
    (strftime('%s', 'now') * 1000)
)
ON CONFLICT(id) DO NOTHING;

-- Then create/update the system user
INSERT INTO users (
    id,
    email,
    name,
    company_id,
    role,
    quota_daily,
    quota_used,
    is_active,
    is_unlimited,
    created_at,
    updated_at
) VALUES (
    'sys-health-user',
    'system@agate.internal',
    'Health Check System',
    'sys-health',
    'system',
    50000,
    0,
    TRUE,
    FALSE,
    (strftime('%s', 'now') * 1000),
    (strftime('%s', 'now') * 1000)
)
ON CONFLICT(id) DO UPDATE SET
    role = 'system',
    quota_daily = 50000,
    updated_at = (strftime('%s', 'now') * 1000);
