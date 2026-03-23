-- Migration 0003: Update users table for system user support (PRD V2 Section 2.4.3)
-- Add is_unlimited column that exists in schema.sql but not in current DB
-- Note: company_id NULL constraint change deferred to avoid D1 foreign key issues

-- Step 1: Add is_unlimited column (SQLite supports ALTER TABLE ADD COLUMN)
ALTER TABLE users ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;

-- Note: For system users, we'll use a special company 'sys-health' instead of NULL
-- This avoids foreign key constraint issues with D1
