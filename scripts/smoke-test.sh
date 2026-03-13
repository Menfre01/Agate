#!/bin/bash
# Smoke Test Script for AI Gateway
#
# Usage: ./scripts/smoke-test.sh <BASE_URL> <API_KEY>
# Example: ./scripts/smoke-test.sh https://ai-gateway.example.com sk_test_xxx

set -e

BASE_URL="${1:-http://localhost:8787}"
API_KEY="${2:-$AI_GATEWAY_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY is required"
  echo "Usage: $0 <BASE_URL> <API_KEY>"
  exit 1
fi

echo "=========================================="
echo "AI Gateway Smoke Test"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "=========================================="
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run a test
run_test() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local expected_status="$4"
  local data="$5"

  echo -n "Testing: $test_name ... "

  local url="${BASE_URL}${endpoint}"
  local status
  local response

  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "x-api-key: $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$url" 2>/dev/null || echo "000")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "x-api-key: $API_KEY" \
      "$url" 2>/dev/null || echo "000")
  fi

  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$status" -eq "$expected_status" ]; then
    echo -e "${GREEN}PASSED${NC} (HTTP $status)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}FAILED${NC} (Expected $expected_status, got $status)"
    if [ -n "$body" ]; then
      echo "  Response: $body" | head -c 200
      echo
    fi
    ((TESTS_FAILED++))
    return 1
  fi
}

# 1. Health Check (no auth required)
echo "1. Health Check"
response=$(curl -s "${BASE_URL}/health" 2>/dev/null || echo "{}")
if echo "$response" | grep -q '"status":"ok"'; then
  echo -e "  ${GREEN}PASSED${NC}"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}FAILED${NC}"
  ((TESTS_FAILED++))
fi
echo

# 2. List Models (GET /v1/models)
echo "2. List Models"
run_test "List available models" "GET" "/v1/models" 200

# 3. Admin: List API Keys (requires admin role)
echo
echo "3. Admin - List API Keys"
run_test "List API keys" "GET" "/admin/keys" 200

# 4. Admin: List Providers
echo
echo "4. Admin - List Providers"
run_test "List providers" "GET" "/admin/providers" 200

# 5. Admin: List Models
echo
echo "5. Admin - List Models"
run_test "List models (admin)" "GET" "/admin/models" 200

# 6. Admin: Get Usage Stats
echo
echo "6. Admin - Usage Stats"
run_test "Get usage statistics" "GET" "/admin/stats/usage" 200

# 7. Admin: Get Token Usage
echo
echo "7. Admin - Token Usage"
run_test "Get token usage" "GET" "/admin/stats/tokens" 200

# 8. Admin: List Quotas
echo
echo "8. Admin - List Quotas"
run_test "List quotas" "GET" "/admin/quotas" 200

# 9. Test CORS Preflight
echo
echo "9. CORS Preflight"
response=$(curl -s -w "\n%{http_code}" -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  "${BASE_URL}/v1/messages" 2>/dev/null || echo "000")
status=$(echo "$response" | tail -n1)

if [ "$status" -eq 204 ]; then
  echo -e "  ${GREEN}PASSED${NC} (HTTP 204)"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}FAILED${NC} (Expected 204, got $status)"
  ((TESTS_FAILED++))
fi

# Summary
echo
echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
