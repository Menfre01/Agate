#!/bin/bash
# Initialize Development API Keys
#
# This script creates test API keys for local development.
# It uses a simple hash mechanism for testing only.

set -e

echo "=========================================="
echo "Creating Development API Keys"
echo "=========================================="

# Generate simple hash (for testing only)
ADMIN_KEY_VALUE="sk_test_admin_${RANDOM}${RANDOM}"
ADMIN_KEY_HASH="hash_${ADMIN_KEY_VALUE}"

USER_KEY_VALUE="sk_test_user_${RANDOM}${RANDOM}"
USER_KEY_HASH="hash_${USER_KEY_VALUE}"

# Current timestamp in milliseconds
TIMESTAMP=$(($(date +%s) * 1000))

# Admin Key (unlimited)
npx wrangler d1 execute ai-gateway-db --local --command "
DELETE FROM api_keys WHERE id = 'ak_test_admin';
INSERT INTO api_keys (
  id, key_hash, key_prefix, user_id, company_id, department_id,
  name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active,
  created_at, updated_at
) VALUES (
  'ak_test_admin',
  '${ADMIN_KEY_HASH}',
  'sk_test_admin_',
  'u_admin',
  'co_demo_company',
  'dept_engineering',
  'Test Admin Key',
  0,
  0,
  0,
  TRUE,
  TRUE,
  ${TIMESTAMP},
  ${TIMESTAMP}
)
" 2>&1 | grep -q "success" && echo "✓ Admin key created"

# User Key (limited)
npx wrangler d1 execute ai-gateway-db --local --command "
DELETE FROM api_keys WHERE id = 'ak_test_user';
INSERT INTO api_keys (
  id, key_hash, key_prefix, user_id, company_id, department_id,
  name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active,
  created_at, updated_at
) VALUES (
  'ak_test_user',
  '${USER_KEY_HASH}',
  'sk_test_user_',
  'u_demo_user',
  'co_demo_company',
  'dept_engineering',
  'Test User Key',
  10000,
  0,
  0,
  FALSE,
  TRUE,
  ${TIMESTAMP},
  ${TIMESTAMP}
)
" 2>&1 | grep -q "success" && echo "✓ User key created"

echo ""
echo "=========================================="
echo "Test API Keys Created!"
echo "=========================================="
echo ""
echo "NOTE: These are test keys with simple hashes."
echo "The AuthService needs to be updated to accept these test hashes."
echo ""
echo "Admin Key: ${ADMIN_KEY_VALUE}"
echo "User Key:  ${USER_KEY_VALUE}"
echo ""
echo "=========================================="
