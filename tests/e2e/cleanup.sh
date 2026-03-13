#!/bin/bash
# AI Gateway E2E Test Cleanup Script
#
# Cleans up all test data created by the E2E test.
# Usage: ./tests/e2e/cleanup.sh [id_file]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load IDs from file or prompt
if [ -n "$1" ] && [ -f "$1" ]; then
  source "$1"
  echo -e "${BLUE}Loaded IDs from: $1${NC}"
else
  echo -e "${YELLOW}No ID file provided. Please enter the IDs to cleanup:${NC}"
  read -p "Company ID (or press Enter to skip): " TEST_COMPANY_ID
  read -p "Department ID (or press Enter to skip): " TEST_DEPT_ID
  read -p "User ID (or press Enter to skip): " TEST_USER_ID
  read -p "Provider ID (or press Enter to skip): " TEST_PROVIDER_ID
  read -p "Model ID (or press Enter to skip): " TEST_MODEL_ID
  read -p "API Key ID (or press Enter to skip): " TEST_API_KEY_ID
fi

GATEWAY_URL="${GATEWAY_BASE_URL:-http://localhost:8787}"

# Load admin key
if [ -f ".env.local" ]; then
  source .env.local
fi

if [ -z "$ADMIN_API_KEY" ]; then
  echo -e "${RED}Error: ADMIN_API_KEY not set${NC}"
  echo "Please set ADMIN_API_KEY in .env.local or pass it as env var"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AI Gateway E2E Cleanup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Helper function for API calls
api_call() {
  local method="$1"
  local endpoint="$2"

  curl --noproxy '*' -s -X "$method" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${ADMIN_API_KEY}" \
    "${GATEWAY_URL}${endpoint}"
}

# Step 1: Delete usage logs
echo -e "\n${YELLOW}[1/8] Delete usage logs${NC}"
# Note: We'll skip this as there's no direct API for it

# Step 2: Delete quota changes
echo -e "\n${YELLOW}[2/8] Delete quota changes${NC}"
# Note: We'll skip this as there's no direct API for it

# Step 3: Delete API Keys
if [ -n "$TEST_API_KEY_ID" ]; then
  echo -e "\n${YELLOW}[3/8] Delete API Key${NC}"
  RESPONSE=$(api_call "DELETE" "/admin/keys/${TEST_API_KEY_ID}")
  if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ API Key deleted${NC}"
  else
    echo -e "${YELLOW}⚠ API Key deletion response:${NC}"
    echo "$RESPONSE" | head -c 200
  fi
fi

# Step 4: Delete department-model permissions
echo -e "\n${YELLOW}[4/8] Delete department-model permissions${NC}"
# Note: This is handled implicitly when departments are deleted

# Step 5: Delete model-provider links
echo -e "\n${YELLOW}[5/8] Delete model-provider links${NC}"
# Note: This is handled implicitly when models/providers are deleted

# Step 6: Delete models
if [ -n "$TEST_MODEL_ID" ]; then
  echo -e "\n${YELLOW}[6/8] Delete Model${NC}"
  RESPONSE=$(api_call "DELETE" "/admin/models/${TEST_MODEL_ID}")
  if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Model deleted${NC}"
  else
    echo -e "${YELLOW}⚠ Model deletion response:${NC}"
    echo "$RESPONSE" | head -c 200
  fi
fi

# Step 7: Delete provider credentials
if [ -n "$TEST_PROVIDER_ID" ]; then
  echo -e "\n${YELLOW}[7/8] Delete Provider${NC}"
  RESPONSE=$(api_call "DELETE" "/admin/providers/${TEST_PROVIDER_ID}")
  if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Provider deleted${NC}"
  else
    echo -e "${YELLOW}⚠ Provider deletion response:${NC}"
    echo "$RESPONSE" | head -c 200
  fi
fi

# Step 8: Delete users, departments, companies
if [ -n "$TEST_USER_ID" ]; then
  echo -e "\n${YELLOW}Delete User${NC}"
  RESPONSE=$(api_call "DELETE" "/admin/users/${TEST_USER_ID}")
  if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ User deleted${NC}"
  else
    echo -e "${YELLOW}⚠ User deletion response:${NC}"
    echo "$RESPONSE" | head -c 200
  fi
fi

if [ -n "$TEST_DEPT_ID" ]; then
  echo -e "\n${YELLOW}Delete Department${NC}"
  RESPONSE=$(api_call "DELETE" "/admin/departments/${TEST_DEPT_ID}")
  if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Department deleted${NC}"
  else
    echo -e "${YELLOW}⚠ Department deletion response:${NC}"
    echo "$RESPONSE" | head -c 200
  fi
fi

if [ -n "$TEST_COMPANY_ID" ]; then
  echo -e "\n${YELLOW}Delete Company${NC}"
  RESPONSE=$(api_call "DELETE" "/admin/companies/${TEST_COMPANY_ID}")
  if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Company deleted${NC}"
  else
    echo -e "${YELLOW}⚠ Company deletion response:${NC}"
    echo "$RESPONSE" | head -c 200
  fi
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Cleanup Completed!${NC}"
echo -e "${GREEN}========================================${NC}"
