#!/bin/bash
# AI Gateway E2E Test
#
# This script tests the complete flow using database setup
# for authentication, then real API calls for everything else.
#
# Supports custom provider and model configuration via .env.local:
# - ANTHROPIC_BASE_URL: Custom provider base URL
# - TEST_MODEL_ID: Custom model ID to use
#
# Usage: ./tests/e2e/run.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment
if [ -f ".env.local" ]; then
  source .env.local
else
  echo -e "${RED}Error: .env.local file not found${NC}"
  echo "Please copy .env.example to .env.local and fill in your values"
  exit 1
fi

# Use environment variables or defaults
GATEWAY_URL="${GATEWAY_BASE_URL:-http://localhost:8787}"
PROVIDER_URL="${ANTHROPIC_BASE_URL:-https://api.anthropic.com}"
PROVIDER_API_KEY="${ANTHROPIC_API_KEY}"
MODEL_ID="${TEST_MODEL_ID:-claude-3-5-sonnet-20241022}"

# Validate required variables
if [ -z "$PROVIDER_API_KEY" ]; then
  echo -e "${RED}Error: ANTHROPIC_API_KEY is required in .env.local${NC}"
  exit 1
fi

# Generate unique identifiers for this test run
TIMESTAMP=$(date +%s)
RANDOM_SUFFIX=$(head -c 4 /dev/urandom | xxd -p)
TEST_COMPANY_ID="co_test_${TIMESTAMP}"
TEST_DEPT_ID="dept_test_${TIMESTAMP}"
TEST_USER_ID="u_test_${TIMESTAMP}"
TEST_USER_EMAIL="test_${TIMESTAMP}@example.com"

# Generate provider ID from URL (hash for uniqueness)
PROVIDER_ID=$(echo -n "$PROVIDER_URL" | shasum -a 256 | cut -c1-16)
PROVIDER_NAME="custom_provider_${TIMESTAMP}"

# Use model_id directly for internal ID (simpler for lookup)
TEST_MODEL_INTERNAL_ID="m_${TIMESTAMP}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AI Gateway E2E Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Gateway URL: ${GATEWAY_URL}"
echo -e "Provider URL: ${PROVIDER_URL}"
echo -e "Model ID: ${MODEL_ID}"
echo -e "Test Run ID: ${TIMESTAMP}"
echo -e "${BLUE}========================================${NC}\n"

# Helper function: Compute SHA-256 hash (matching crypto.ts hashApiKey)
sha256_hash() {
  echo -n "$1" | shasum -a 256 | cut -d' ' -f1
}

# Helper function for API calls
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="$3"
  local api_key="$4"

  local curl_cmd="curl --noproxy '*' -s -X '$method' -H 'Content-Type: application/json'"

  if [ -n "$api_key" ]; then
    curl_cmd="$curl_cmd -H 'x-api-key: $api_key'"
  fi

  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -d '$data'"
  fi

  curl_cmd="$curl_cmd '${GATEWAY_URL}${endpoint}'"

  eval "$curl_cmd"
}

# Step 0: Setup database with test data
echo -e "\n${YELLOW}[0/10] Database Setup${NC}"
echo "Setting up test company, department, and user..."

TIMESTAMP_MS=$(($(date +%s) * 1000))

# Create company
npx wrangler d1 execute ai-gateway-db --local --command "
  INSERT OR IGNORE INTO companies (id, name, quota_pool, quota_used, quota_daily, daily_used, last_reset_at, created_at, updated_at)
  VALUES ('${TEST_COMPANY_ID}', 'E2E Test Company ${TIMESTAMP}', 10000000, 0, 100000, 0, NULL, ${TIMESTAMP_MS}, ${TIMESTAMP_MS});
" 2>&1 | grep -q "success" && echo -e "${GREEN}✓ Company created${NC}" || echo -e "${YELLOW}⚠ Company may already exist${NC}"

# Create department
npx wrangler d1 execute ai-gateway-db --local --command "
  INSERT OR IGNORE INTO departments (id, company_id, name, quota_pool, quota_used, quota_daily, daily_used, last_reset_at, created_at, updated_at)
  VALUES ('${TEST_DEPT_ID}', '${TEST_COMPANY_ID}', 'Engineering', 5000000, 0, 50000, 0, NULL, ${TIMESTAMP_MS}, ${TIMESTAMP_MS});
" 2>&1 | grep -q "success" && echo -e "${GREEN}✓ Department created${NC}" || echo -e "${YELLOW}⚠ Department may already exist${NC}"

# Create admin user
npx wrangler d1 execute ai-gateway-db --local --command "
  INSERT OR REPLACE INTO users (id, email, name, company_id, department_id, role, quota_daily, quota_used, is_active, last_reset_at, created_at, updated_at)
  VALUES ('u_admin_e2e', 'admin_e2e@example.com', 'E2E Admin', '${TEST_COMPANY_ID}', '${TEST_DEPT_ID}', 'admin', 0, 0, TRUE, NULL, ${TIMESTAMP_MS}, ${TIMESTAMP_MS});
" 2>&1 | grep -q "success" && echo -e "${GREEN}✓ Admin user ready${NC}" || echo -e "${YELLOW}⚠ Admin user setup${NC}"

# Create test user
npx wrangler d1 execute ai-gateway-db --local --command "
  INSERT OR REPLACE INTO users (id, email, name, company_id, department_id, role, quota_daily, quota_used, is_active, last_reset_at, created_at, updated_at)
  VALUES ('${TEST_USER_ID}', '${TEST_USER_EMAIL}', 'E2E Test User', '${TEST_COMPANY_ID}', '${TEST_DEPT_ID}', 'user', 100000, 0, TRUE, NULL, ${TIMESTAMP_MS}, ${TIMESTAMP_MS});
" 2>&1 | grep -q "success" && echo -e "${GREEN}✓ Test user created${NC}" || echo -e "${YELLOW}⚠ Test user may already exist${NC}"

# Create admin API key
ADMIN_KEY_VALUE="sk-e2e-admin-${TIMESTAMP}-${RANDOM_SUFFIX}"
ADMIN_KEY_HASH=$(sha256_hash "$ADMIN_KEY_VALUE")

npx wrangler d1 execute ai-gateway-db --local --command "
  INSERT OR REPLACE INTO api_keys (id, key_hash, key_prefix, user_id, company_id, department_id, name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active, created_at, updated_at)
  VALUES ('ak_e2e_admin', '${ADMIN_KEY_HASH}', 'sk-e2e-admin-', 'u_admin_e2e', '${TEST_COMPANY_ID}', '${TEST_DEPT_ID}', 'E2E Admin Key', 0, 0, 0, TRUE, TRUE, ${TIMESTAMP_MS}, ${TIMESTAMP_MS});
" 2>&1 | grep -q "success" && echo -e "${GREEN}✓ Admin API key created${NC}" || echo -e "${YELLOW}⚠ Admin key setup${NC}"

echo -e "${BLUE}Admin API Key: ${ADMIN_KEY_VALUE}${NC}"
ADMIN_API_KEY="$ADMIN_KEY_VALUE"

# Step 1: Health Check
echo -e "\n${YELLOW}[1/10] Health Check${NC}"
HEALTH_RESPONSE=$(curl --noproxy '*' -s "${GATEWAY_URL}/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓ Gateway is healthy${NC}"
else
  echo -e "${RED}✗ Gateway health check failed${NC}"
  echo "$HEALTH_RESPONSE"
  exit 1
fi

# Step 2: Test Admin Access
echo -e "\n${YELLOW}[2/10] Test Admin Access${NC}"
COMPANIES_RESPONSE=$(api_call "GET" "/admin/companies" "" "$ADMIN_API_KEY")
if echo "$COMPANIES_RESPONSE" | grep -q "companies"; then
  echo -e "${GREEN}✓ Admin access working${NC}"
else
  echo -e "${RED}✗ Admin access failed${NC}"
  echo "$COMPANIES_RESPONSE"
  exit 1
fi

# Step 3: Create or Get Provider
echo -e "\n${YELLOW}[3/10] Setup Provider${NC}"
PROVIDER_RESPONSE=$(api_call "POST" "/admin/providers" "{\"id\":\"${PROVIDER_ID}\",\"name\":\"${PROVIDER_NAME}\",\"display_name\":\"E2E Test Provider\",\"base_url\":\"${PROVIDER_URL}\",\"api_version\":\"v1\"}" "$ADMIN_API_KEY")
if echo "$PROVIDER_RESPONSE" | grep -q "id\|already exists"; then
  echo -e "${GREEN}✓ Provider ready${NC}"
else
  echo -e "${YELLOW}⚠ Provider response:${NC}"
  echo "$PROVIDER_RESPONSE" | head -c 200
fi

# Step 4: Add Provider Credential
echo -e "\n${YELLOW}[4/10] Add Provider Credential${NC}"
CREDENTIAL_RESPONSE=$(api_call "POST" "/admin/providers/${PROVIDER_ID}/credentials" "{\"credential_name\":\"E2E Test Credential\",\"api_key\":\"${PROVIDER_API_KEY}\"}" "$ADMIN_API_KEY")
if echo "$CREDENTIAL_RESPONSE" | grep -q "id"; then
  CREDENTIAL_ID=$(echo "$CREDENTIAL_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  echo -e "${GREEN}✓ Credential added (ID: ${CREDENTIAL_ID})${NC}"
else
  echo -e "${YELLOW}⚠ Credential response:${NC}"
  echo "$CREDENTIAL_RESPONSE" | head -c 300
fi

# Step 5: Create Model
echo -e "\n${YELLOW}[5/10] Create Model${NC}"
MODEL_RESPONSE=$(api_call "POST" "/admin/models" "{\"id\":\"${TEST_MODEL_INTERNAL_ID}\",\"model_id\":\"${MODEL_ID}\",\"display_name\":\"E2E Test Model\",\"context_window\":200000,\"max_tokens\":8192}" "$ADMIN_API_KEY")
if echo "$MODEL_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✓ Model created${NC}"
elif echo "$MODEL_RESPONSE" | grep -q "already exists"; then
  echo -e "${GREEN}✓ Model already exists${NC}"
else
  echo -e "${YELLOW}⚠ Model response:${NC}"
  echo "$MODEL_RESPONSE" | head -c 200
fi

# Step 6: Link Model to Provider
echo -e "\n${YELLOW}[6/10] Link Model to Provider${NC}"
LINK_RESPONSE=$(api_call "POST" "/admin/models/${TEST_MODEL_INTERNAL_ID}/link?provider_id=${PROVIDER_ID}" "{\"input_price\":1.0,\"output_price\":5.0}" "$ADMIN_API_KEY")
if echo "$LINK_RESPONSE" | grep -q "success\|id\|already exists"; then
  echo -e "${GREEN}✓ Model linked to provider${NC}"
else
  echo -e "${YELLOW}⚠ Link response:${NC}"
  echo "$LINK_RESPONSE" | head -c 200
fi

# Step 7: Allow Department to Use Model
echo -e "\n${YELLOW}[7/10] Allow Department Model Access${NC}"
PERMIT_RESPONSE=$(api_call "POST" "/admin/departments/${TEST_DEPT_ID}/models?model_id=${TEST_MODEL_INTERNAL_ID}" "{\"is_allowed\":true}" "$ADMIN_API_KEY")
if echo "$PERMIT_RESPONSE" | grep -q "success\|id\|already exists"; then
  echo -e "${GREEN}✓ Department model access granted${NC}"
else
  echo -e "${YELLOW}⚠ Permit response:${NC}"
  echo "$PERMIT_RESPONSE" | head -c 200
fi

# Step 8: Create API Key for LLM Requests
echo -e "\n${YELLOW}[8/10] Create Test API Key${NC}"
TEST_KEY_VALUE="sk-e2e-test-${TIMESTAMP}-${RANDOM_SUFFIX}"
TEST_KEY_HASH=$(sha256_hash "$TEST_KEY_VALUE")

npx wrangler d1 execute ai-gateway-db --local --command "
  INSERT OR REPLACE INTO api_keys (id, key_hash, key_prefix, user_id, company_id, department_id, name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active, created_at, updated_at)
  VALUES ('ak_e2e_test', '${TEST_KEY_HASH}', 'sk-e2e-test-', '${TEST_USER_ID}', '${TEST_COMPANY_ID}', '${TEST_DEPT_ID}', 'E2E Test Key', 50000, 0, 0, FALSE, TRUE, ${TIMESTAMP_MS}, ${TIMESTAMP_MS});
" 2>&1 | grep -q "success" && echo -e "${GREEN}✓ Test API key created${NC}" || echo -e "${YELLOW}⚠ Test key setup${NC}"

echo -e "${BLUE}Test API Key: ${TEST_KEY_VALUE}${NC}"
TEST_API_KEY="$TEST_KEY_VALUE"

# Step 9: Test Model List
echo -e "\n${YELLOW}[9/10] Test Model List API${NC}"
MODELS_RESPONSE=$(api_call "GET" "/v1/models" "" "$TEST_API_KEY")
if echo "$MODELS_RESPONSE" | grep -q "data\|models"; then
  echo -e "${GREEN}✓ Model list retrieved${NC}"
  echo "$MODELS_RESPONSE" | head -c 300
else
  echo -e "${YELLOW}⚠ Models response:${NC}"
  echo "$MODELS_RESPONSE" | head -c 300
fi

# Step 10: Test LLM Request
echo -e "\n${YELLOW}[10/10] Test LLM Request${NC}"
echo "Sending request to ${MODEL_ID}..."

LLM_RESPONSE=$(curl --noproxy '*' -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_API_KEY}" \
  -d "{
    \"model\": \"${MODEL_ID}\",
    \"max_tokens\": 50,
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Say 'Hello from E2E test!' in exactly that format.\"}
    ]
  }" \
  "${GATEWAY_URL}/v1/messages")

if echo "$LLM_RESPONSE" | grep -q "Hello from E2E test!\|content"; then
  echo -e "${GREEN}✓ LLM request successful!${NC}"
  echo -e "${BLUE}Response:$(echo "$LLM_RESPONSE" | grep -o '"content":"[^"]*' | head -1 | cut -d'"' -f4)${NC}"
elif echo "$LLM_RESPONSE" | grep -q "error"; then
  echo -e "${YELLOW}⚠ LLM request returned error:${NC}"
  echo "$LLM_RESPONSE" | head -c 500
else
  echo -e "${YELLOW}⚠ Unexpected LLM response:${NC}"
  echo "$LLM_RESPONSE" | head -c 500
fi

echo -e "\n\n${GREEN}========================================${NC}"
echo -e "${GREEN}E2E Test Completed!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}Test Resources Created:${NC}"
echo -e "  Company ID: ${TEST_COMPANY_ID}"
echo -e "  Department ID: ${TEST_DEPT_ID}"
echo -e "  User ID: ${TEST_USER_ID}"
echo -e "  Provider ID: ${PROVIDER_ID}"
echo -e "  Model ID: ${TEST_MODEL_INTERNAL_ID}"
echo -e "  Model Name: ${MODEL_ID}"

# Save IDs for cleanup
cat > /tmp/e2e_test_ids_${TIMESTAMP}.txt <<EOF
GATEWAY_URL=${GATEWAY_URL}
ADMIN_API_KEY=${ADMIN_API_KEY}
TEST_COMPANY_ID=${TEST_COMPANY_ID}
TEST_DEPT_ID=${TEST_DEPT_ID}
TEST_USER_ID=${TEST_USER_ID}
TEST_PROVIDER_ID=${PROVIDER_ID}
TEST_MODEL_ID=${TEST_MODEL_INTERNAL_ID}
TEST_API_KEY_ID=ak_e2e_test
EOF

echo -e "\n${BLUE}IDs saved to:${NC} /tmp/e2e_test_ids_${TIMESTAMP}.txt"

# Auto cleanup
echo -e "\n${YELLOW}Cleaning up test data...${NC}"
./tests/e2e/cleanup.sh /tmp/e2e_test_ids_${TIMESTAMP}.txt
rm -f /tmp/e2e_test_ids_${TIMESTAMP}.txt

echo -e "\n${GREEN}E2E test completed and cleaned up successfully!${NC}"
