-- Migration: Add alias field to models table
--
-- Changes:
-- 1. Adds optional alias column for model name mapping
-- 2. Creates index on alias for efficient lookups
--
-- This migration enables model alias mapping, where users can request a model
-- by a friendly name (e.g., "opus") and the system will use the configured
-- alias (e.g., "glm-5") for upstream requests.

-- Step 1: Add alias column to models table
ALTER TABLE models ADD COLUMN alias TEXT UNIQUE;

-- Step 2: Create index on alias for efficient lookups
CREATE INDEX IF NOT EXISTS idx_models_alias ON models(alias);
