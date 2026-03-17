-- Migration: n:n Model-Provider Relationship
--
-- Changes:
-- 1. Creates new model_providers table for n:n relationship
-- 2. Migrates existing data from models.provider_id to model_providers
-- 3. Removes provider_id, input_price, output_price from models table
--
-- This migration transforms the model-provider relationship from n:1 to n:n,
-- enabling cross-provider load balancing.

-- Step 1: Create new model_providers table
CREATE TABLE IF NOT EXISTS model_providers (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    input_price REAL DEFAULT 0,
    output_price REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    UNIQUE(model_id, provider_id)
);

-- Step 2: Migrate existing data from models to model_providers
INSERT INTO model_providers (id, model_id, provider_id, input_price, output_price, is_active, created_at, updated_at)
SELECT
    lower(hex(randomblob(16))) as id,
    id as model_id,
    provider_id,
    input_price,
    output_price,
    CAST(is_active AS INTEGER) as is_active,
    created_at,
    updated_at
FROM models
WHERE provider_id IS NOT NULL;

-- Step 3: Create new models table without provider-related columns
CREATE TABLE IF NOT EXISTS models_new (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    context_window INTEGER DEFAULT 0,
    max_tokens INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Step 4: Copy data to new models table
INSERT INTO models_new SELECT id, model_id, display_name, context_window, max_tokens, is_active, created_at, updated_at FROM models;

-- Step 5: Drop old models table and rename new one
DROP TABLE models;
ALTER TABLE models_new RENAME TO models;

-- Step 6: Recreate models indexes
CREATE INDEX idx_models_model_id ON models(model_id);
CREATE INDEX idx_models_active ON models(is_active);

-- Step 7: Create model_providers indexes
CREATE INDEX idx_model_providers_model_id ON model_providers(model_id);
CREATE INDEX idx_model_providers_provider_id ON model_providers(provider_id);
CREATE INDEX idx_model_providers_active ON model_providers(is_active);
