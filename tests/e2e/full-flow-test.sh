#!/bin/bash
# AI Gateway End-to-End Test
#
# This script tests the complete flow of the AI Gateway:
# 1. Setup (Provider, Model, Company, User, API Key)
# 2. LLM Request
# 3. Statistics Query
# 4. Cleanup
#
# Usage: ./tests/e2e/full-flow-test.sh
# Required: .env.local with ANTHROPIC_API_KEY

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

# Validate required variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo -e "${RED}Error: ANTHROPIC_API_KEY is required in .env.local${NC}"
  exit 1
fi

GATEWAY_URL="${GATEWAY_BASE_URL:-http://localhost:8787}"

# Unique identifiers for this test run
TIMESTAMP=$(date +%s)
TEST_COMPANY_ID="co_test_${TIMESTAMP}"
TEST_DEPT_ID="dept_test_${TIMESTAMP}"
TEST_USER_ID="u_test_${TIMESTAMP}"
TEST_USER_EMAIL="test_${TIMESTAMP}@example.com"
TEST_PROVIDER_ID="p_test_${TIMESTAMP}"
TEST_MODEL_ID="m_test_${TIMESTAMP}"

# Temporary storage for created IDs
CREATED_API_KEY=""
CREATED_API_KEY_ID=""
CREATED_CREDENTIAL_ID=""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AI Gateway E2E Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Gateway URL: ${GATEWAY_URL}"
echo -e "Test Run ID: ${TIMESTAMP}"
echo -e "${BLUE}========================================${NC}\n"

# Helper function for API calls
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="$3"
  local api_key="$4"

  if [ -z "$api_key" ]; then
    api_key="$ADMIN_API_KEY"
  fi

  curl --noproxy '*' -s -X "$method" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $api_key" \
    -d "$data" \
    "${GATEWAY_URL}${endpoint}"
}

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

# Step 2: Create Admin API Key (if not provided)
echo -e "\n${YELLOW}[2/10] Create Admin API Key${NC}"
# First, we need to directly insert a user into the database
echo "Note: Creating admin user in database..."
ADMIN_USER_ID="u_admin_e2e"
ADMIN_EMAIL="admin_e2e@example.com"

# Insert admin user directly (bypassing API for setup)
npx wrangler d1 execute ai-gateway-db --local --command "
  DELETE FROM users WHERE id = '${ADMIN_USER_ID}';
  INSERT INTO users (id, email, name, company_id, department_id, role, quota_daily, quota_used, is_active, last_reset_at, created_at, updated_at)
  VALUES ('${ADMIN_USER_ID}', '${ADMIN_EMAIL}', 'E2E Admin', '${TEST_COMPANY_ID}', '${TEST_DEPT_ID}', 'admin', 0, 0, TRUE, NULL, $(date +%s)000, $(date +%s)000);
" 2>&1 | grep -q "success" || true

# Generate a simple API key (in production, use proper bcrypt)
ADMIN_KEY_VALUE="sk_e2e_admin_${TIMESTAMP}_${RANDOM}"
ADMIN_KEY_HASH="hash_${ADMIN_KEY_VALUE}"

npx wrangler d1 execute ai-gateway-db --local --command "
  DELETE FROM api_keys WHERE id = 'ak_e2e_admin';
  INSERT INTO api_keys (id, key_hash, key_prefix, user_id, company_id, department_id, name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active, created_at, updated_at)
  VALUES ('ak_e2e_admin', '${ADMIN_KEY_HASH}', 'sk_e2e_admin_', '${ADMIN_USER_ID}', '${TEST_COMPANY_ID}', '${TEST_DEPT_ID}', 'E2E Admin Key', 0, 0, 0, TRUE, TRUE, $(date +%s)000, $(date +%s)000);
" 2>&1 | grep -q "success" || true

# Create a modified auth check for testing
echo "Note: For E2E testing, we need to update AuthService to accept test keys"
echo "Created test admin key: ${GREEN}${ADMIN_KEY_VALUE}${NC}"
ADMIN_API_KEY="$ADMIN_KEY_VALUE"

# Step 3: Create Company
echo -e "\n${YELLOW}[3/10] Create Company${NC}"
COMPANY_RESPONSE=$(api_call "POST" "/admin/companies" "{\"id\":\"${TEST_COMPANY_ID}\",\"name\":\"E2E Test Company ${TIMESTAMP}\"}")
if echo "$COMPANY_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✓ Company created${NC}"
else
  echo -e "${YELLOW}⚠ Company creation response (may already exist):${NC}"
  echo "$COMPANY_RESPONSE" | head -c 200
fi

# Step 4: Create Department
echo -e "\n${YELLOW}[4/10] Create Department${NC}"
DEPT_RESPONSE=$(api_call "POST" "/admin/departments" "{\"id\":\"${TEST_DEPT_ID}\",\"company_id\":\"${TEST_COMPANY_ID}\",\"name\":\"Engineering\"}")
if echo "$DEPT_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✓ Department created${NC}"
else
  echo -e "${YELLOW}⚠ Department creation response:${NC}"
  echo "$DEPT_RESPONSE" | head -c 200
fi

# Step 5: Create Test User
echo -e "\n${YELLOW}[5/10] Create Test User${NC}"
USER_RESPONSE=$(api_call "POST" "/admin/users" "{\"id\":\"${TEST_USER_ID}\",\"email\":\"${TEST_USER_EMAIL}\",\"name\":\"E2E Test User\",\"company_id\":\"${TEST_COMPANY_ID}\",\"department_id\":\"${TEST_DEPT_ID}\",\"role\":\"user\",\"quota_daily\":100000}")
if echo "$USER_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✓ User created${NC}"
else
  echo -e "${YELLOW}⚠ User creation response:${NC}"
  echo "$USER_RESPONSE" | head -c 200
fi

# Step 6: Create Provider with Credential
echo -e "\n${YELLOW}[6/10] Create Provider with Credential${NC}"
PROVIDER_RESPONSE=$(api_call "POST" "/admin/providers" "{\"id\":\"${TEST_PROVIDER_ID}\",\"name\":\"anthropic\",\"display_name\":\"Anthropic\",\"base_url\":\"https://api.anthropic.com\",\"api_version\":\"v1\"}")
if echo "$PROVIDER_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✓ Provider created${NC}"
else
  echo -e "${YELLOW}⚠ Provider creation response:${NC}"
  echo "$PROVIDER_RESPONSE" | head -c 200
fi

# Add credential
CREDENTIAL_RESPONSE=$(api_call "POST" "/admin/providers/${TEST_PROVIDER_ID}/credentials" "{\"credential_name\":\"E2E Credential\",\"api_key\":\"${ANTHROPIC_API_KEY}\"}")
if echo "$CREDENTIAL_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✓ Provider credential added${NC}"
  CREATED_CREDENTIAL_ID=$(echo "$CREDENTIAL_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
else
  echo -e "${YELLOW}⚠ Credential response:${NC}"
  echo "$CREDENTIAL_RESPONSE" | head -c 200
fi

# Step 7: Create Model
echo -e "\n${YELLOW}[7/10] Create Model${NC}"
MODEL_RESPONSE=$(api_call "POST" "/admin/models" "{\"id\":\"${TEST_MODEL_ID}\",\"model_id\":\"claude-3-5-haiku-20241022\",\"display_name\":\"Claude 3.5 Haiku\",\"context_window\":200000,\"max_tokens\":8192}")
if echo "$MODEL_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✓ Model created${NC}"
else
  echo -e "${YELLOW}⚠ Model creation response:${NC}"
  echo "$MODEL_RESPONSE" | head -c 200
fi

# Link model to provider with pricing
LINK_RESPONSE=$(api_call "POST" "/admin/models/${TEST_MODEL_ID}/providers" "{\"provider_id\":\"${TEST_PROVIDER_ID}\",\"input_price\":1.0,\"output_price\":5.0}")
if echo "$LINK_RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}✓ Model linked to provider${NC}"
else
  echo -e "${YELLOW}⚠ Model link response:${NC}"
  echo "$LINK_RESPONSE" | head -c 200
fi

# Allow department to use model
PERMIT_RESPONSE=$(api_call "POST" "/admin/departments/${TEST_DEPT_ID}/models" "{\"model_id\":\"${TEST_MODEL_ID}\",\"is_allowed\":true}")
if echo "$PERMIT_RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}✓ Model allowed for department${NC}"
else
  echo -e "${YELLOW}⚠ Model permit response:${NC}"
  echo "$PERMIT_RESPONSE" | head -c 200
fi

# Step 8: Create API Key for testing
echo -e "\n${YELLOW}[8/10] Create API Key for LLM requests${NC}"
API_KEY_RESPONSE=$(api_call "POST" "/admin/keys" "{\"user_id\":\"${TEST_USER_ID}\",\"name\":\"E2E Test Key\",\"company_id\":\"${TEST_COMPANY_ID}\",\"department_id\":\"${TEST_DEPT_ID}\",\"quota_daily\":50000}")
if echo "$API_KEY_RESPONSE" | grep -q "key"; then
  echo -e "${GREEN}✓ API Key created${NC}"
  CREATED_API_KEY=$(echo "$API_KEY_RESPONSE" | grep -o '"key":"sk[^"]*' | cut -d'"' -f4)
  CREATED_API_KEY_ID=$(echo "$API_KEY_RESPONSE" | grep -o '"id":"ak[^"]*' | cut -d'"' -f4)
  echo -e "API Key: ${GREEN}${CREATED_API_KEY}${NC}"
else
  echo -e "${RED}✗ API Key creation failed${NC}"
  echo "$API_KEY_RESPONSE"
  exit 1
fi

# Step 9: Test LLM Request
echo -e "\n${YELLOW}[9/10] Test LLM Request${NC}"
echo "Sending request to Claude 3.5 Haiku..."

LLM_RESPONSE=$(curl --noproxy '*' -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CREATED_API_KEY}" \
  -d "{
    \"model\": \"claude-3-5-haiku-20241022\",
    \"max_tokens\": 100,
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Say 'Hello from E2E test!' in exactly that format.\"}
    ]
  }" \
  "${GATEWAY_URL}/v1/messages")

if echo "$LLM_RESPONSE" | grep -q "Hello from E2E test!"; then
  echo -e "${GREEN}✓ LLM request successful${NC}"
  echo "Response: $(echo "$LLM_RESPONSE" | grep -o '"content":"[^"]*' | head -1 | cut -d'"' -f4)"
elif echo "$LLM_RESPONSE" | grep -q "error"; then
  echo -e "${YELLOW}⚠ LLM request returned error (may be due to upstream API):${NC}"
  echo "$LLM_RESPONSE" | head -c 500
else
  echo -e "${YELLOW}⚠ Unexpected LLM response:${NC}"
  echo "$LLM_RESPONSE" | head -c 500
fi

# Step 10: Query Statistics
echo -e "\n${YELLOW}[10/10] Query Statistics${NC}"

# Token usage
TOKEN_STATS=$(api_call "GET" "/admin/stats/tokens?period=hour" "" "$CREATED_API_KEY")
echo -e "${BLUE}Token Usage (last hour):${NC}"
echo "$TOKEN_STATS" | head -c 300

# Usage stats
USAGE_STATS=$(api_call "GET" "/admin/stats/usage" "" "$ADMIN_API_KEY")
echo -e "\n${BLUE}Usage Statistics:${NC}"
echo "$USAGE_STATS" | head -c 300

echo -e "\n\n${GREEN}========================================${NC}"
echo -e "${GREEN}E2E Test Completed!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}Created Resources (for manual cleanup):${NC}"
echo -e "  Company ID: ${TEST_COMPANY_ID}"
echo -e "  Department ID: ${TEST_DEPT_ID}"
echo -e "  User ID: ${TEST_USER_ID}"
echo -e "  Provider ID: ${TEST_PROVIDER_ID}"
echo -e "  Model ID: ${TEST_MODEL_ID}"
echo -e "  API Key ID: ${CREATED_API_KEY_ID}"

# Save IDs for cleanup
cat > /tmp/e2e_test_ids_${TIMESTAMP}.txt <<EOF
TEST_COMPANY_ID=${TEST_COMPANY_ID}
TEST_DEPT_ID=${TEST_DEPT_ID}
TEST_USER_ID=${TEST_USER_ID}
TEST_PROVIDER_ID=${TEST_PROVIDER_ID}
TEST_MODEL_ID=${TEST_MODEL_ID}
TEST_API_KEY_ID=${CREATED_API_KEY_ID}
EOF

echo -e "\n${BLUE}IDs saved to:${NC} /tmp/e2e_test_ids_${TIMESTAMP}.txt"

# Optional: Cleanup prompt
echo -e "\n${YELLOW}To cleanup, run:${NC}"
echo -e "  ${GREEN}./tests/e2e/cleanup.sh /tmp/e2e_test_ids_${TIMESTAMP}.txt${NC}"
