-- Reset database - drop all tables in correct order (respecting foreign keys)
-- Use this to completely reset the database

DELETE FROM quota_changes;
DELETE FROM usage_logs;
DELETE FROM provider_credentials;
DELETE FROM api_keys;
DELETE FROM department_models;
DELETE FROM model_providers;
DELETE FROM models;
DELETE FROM providers;
DELETE FROM users;
DELETE FROM departments;
DELETE FROM companies;
