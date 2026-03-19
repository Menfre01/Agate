-- AI Gateway Database Schema
-- D1 (SQLite) - Cloudflare Workers
-- Based on PRD Section 3.2

-- ============================================
-- 3.2.1 Organization Tables
-- ============================================

-- Companies table
CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    quota_pool INTEGER DEFAULT 0,
    quota_used INTEGER DEFAULT 0,
    quota_daily INTEGER DEFAULT 0,
    daily_used INTEGER DEFAULT 0,
    last_reset_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Departments table
CREATE TABLE departments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quota_pool INTEGER DEFAULT 0,
    quota_used INTEGER DEFAULT 0,
    quota_daily INTEGER DEFAULT 0,
    daily_used INTEGER DEFAULT 0,
    last_reset_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    company_id TEXT NOT NULL,
    department_id TEXT,
    role TEXT DEFAULT 'user',
    quota_daily INTEGER DEFAULT 0,
    quota_used INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_reset_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- ============================================
-- 3.2.2 Provider and Model Tables
-- ============================================

-- Providers table
CREATE TABLE providers (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_version TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Models table (independent of providers - n:n relationship via model_providers)
CREATE TABLE models (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL UNIQUE,
    alias TEXT UNIQUE,
    display_name TEXT NOT NULL,
    context_window INTEGER DEFAULT 0,
    max_tokens INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Model-Provider configuration table (n:n relationship)
CREATE TABLE model_providers (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    input_price REAL DEFAULT 0,
    output_price REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    UNIQUE(model_id, provider_id)
);

-- Department Models configuration table
CREATE TABLE department_models (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    is_allowed BOOLEAN DEFAULT TRUE,
    daily_quota INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (model_id) REFERENCES models(id),
    UNIQUE(department_id, model_id)
);

-- ============================================
-- 3.2.3 API Keys and Credentials Tables
-- ============================================

-- API Keys table
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    department_id TEXT,
    name TEXT,
    quota_daily INTEGER DEFAULT 0,
    quota_used INTEGER DEFAULT 0,
    quota_bonus INTEGER DEFAULT 0,
    quota_bonus_expiry INTEGER,
    is_unlimited BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_reset_at INTEGER,
    last_used_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Provider Credentials table
CREATE TABLE provider_credentials (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    credential_name TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    base_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    weight INTEGER DEFAULT 1,
    health_status TEXT DEFAULT 'unknown',
    last_health_check INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);

-- ============================================
-- 3.2.4 Usage and Quota Tables
-- ============================================

-- Usage Logs table
CREATE TABLE usage_logs (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    department_id TEXT,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    error_code TEXT,
    request_id TEXT,
    response_time_ms INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

-- Quota Changes table
CREATE TABLE quota_changes (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    change_amount INTEGER NOT NULL,
    previous_quota INTEGER NOT NULL,
    new_quota INTEGER NOT NULL,
    reason TEXT,
    created_by TEXT,
    created_at INTEGER NOT NULL
);

-- ============================================
-- Indexes for Performance Optimization
-- ============================================

-- Companies indexes
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_active ON companies(quota_pool, quota_used);

-- Departments indexes
CREATE INDEX idx_departments_company_id ON departments(company_id);
CREATE INDEX idx_departments_name ON departments(company_id, name);

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_active ON users(company_id, is_active);

-- Providers indexes
CREATE INDEX idx_providers_name ON providers(name);
CREATE INDEX idx_providers_active ON providers(is_active);

-- Models indexes
CREATE INDEX idx_models_model_id ON models(model_id);
CREATE INDEX idx_models_alias ON models(alias);
CREATE INDEX idx_models_active ON models(is_active);

-- Model-Providers indexes
CREATE INDEX idx_model_providers_model_id ON model_providers(model_id);
CREATE INDEX idx_model_providers_provider_id ON model_providers(provider_id);
CREATE INDEX idx_model_providers_active ON model_providers(is_active);

-- Department Models indexes
CREATE INDEX idx_department_models_department_id ON department_models(department_id);
CREATE INDEX idx_department_models_model_id ON department_models(model_id);

-- API Keys indexes (critical for authentication)
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_company_id ON api_keys(company_id);
CREATE INDEX idx_api_keys_department_id ON api_keys(department_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active, is_unlimited);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- Provider Credentials indexes
CREATE INDEX idx_provider_credentials_provider_id ON provider_credentials(provider_id);
CREATE INDEX idx_provider_credentials_active ON provider_credentials(is_active, health_status);
CREATE INDEX idx_provider_credentials_priority ON provider_credentials(provider_id, priority DESC);

-- Usage Logs indexes (for analytics and reporting)
CREATE INDEX idx_usage_logs_api_key_id ON usage_logs(api_key_id);
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_company_id ON usage_logs(company_id);
CREATE INDEX idx_usage_logs_department_id ON usage_logs(department_id);
CREATE INDEX idx_usage_logs_provider_id ON usage_logs(provider_id);
CREATE INDEX idx_usage_logs_model_id ON usage_logs(model_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_status ON usage_logs(status);

-- Quota Changes indexes
CREATE INDEX idx_quota_changes_entity ON quota_changes(entity_type, entity_id);
CREATE INDEX idx_quota_changes_created_at ON quota_changes(created_at);
