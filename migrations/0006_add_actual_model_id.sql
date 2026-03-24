-- Migration 0006: Add actual_model_id to model_providers table
-- Based on PRD V2 Section 2.5 (ModelProviders level configuration)
--
-- This enables model alias mapping where different providers
-- can use different model names for the same logical model.
--
-- Example:
--   User requests "claude-3-sonnet"
--   - Anthropic provider: actual_model_id = NULL (uses model_id directly)
--   - Zhipu provider: actual_model_id = "glm-4"
--   - DeepSeek provider: actual_model_id = "deepseek-chat"

-- Add actual_model_id column to model_providers
ALTER TABLE model_providers ADD COLUMN actual_model_id TEXT;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_model_providers_actual_model_id ON model_providers(actual_model_id);
