-- Migration 0002: Update provider_credentials table for consistent hash load balancing
-- Based on PRD V2 Section 2.6 (remove priority/weight) and 2.3 (add health check fields)

-- Step 1: Create new provider_credentials table with updated schema
CREATE TABLE provider_credentials_new (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    credential_name TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    base_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    health_check_model_id TEXT,
    health_status TEXT DEFAULT 'unknown',
    last_health_check INTEGER,
    last_check_success INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);

-- Step 2: Copy data from old table to new table (dropping priority and weight columns)
INSERT INTO provider_credentials_new (
    id, provider_id, credential_name, api_key_encrypted, base_url, is_active,
    health_status, last_health_check, created_at, updated_at
)
SELECT
    id, provider_id, credential_name, api_key_encrypted, base_url, is_active,
    health_status, last_health_check, created_at, updated_at
FROM provider_credentials;

-- Step 3: Drop old table
DROP TABLE provider_credentials;

-- Step 4: Rename new table to original name
ALTER TABLE provider_credentials_new RENAME TO provider_credentials;

-- Step 5: Drop old priority index (no longer needed)
DROP INDEX IF EXISTS idx_provider_credentials_priority;

-- Step 6: Create index for health status filtering (useful for consistent hash)
CREATE INDEX idx_provider_credentials_health ON provider_credentials(provider_id, health_status, is_active);
