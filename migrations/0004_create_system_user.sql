-- Migration 0004: Create/update system user for health check (PRD V2 Section 2.4.3)

-- Update existing system user or insert new one
-- Using 'sys-health' company due to NOT NULL constraint on company_id
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
