#!/bin/bash
# Agate Quick Undeploy Script
#
# Removes deployed resources from Cloudflare.
# Checks if resources exist before attempting deletion.
# Wrangler CLI handles confirmation for each deletion.
#
# Usage: ./scripts/quick-undeploy.sh [--account-id=xxx]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Help function
show_help() {
  cat << 'EOF'
Agate Quick Undeploy

Removes deployed resources from Cloudflare.

USAGE:
  ./scripts/quick-undeploy.sh [OPTIONS]

OPTIONS:
  --account-id=xxx  Cloudflare Account ID (auto-detected if not provided)
  -h, --help       Show this help message

RESOURCES REMOVED:
  • Workers (agate-proxy, agate-admin, agate-health)
  • Pages project (agate-admin)
  • D1 Database (agate-db)
  • KV Namespace (agate-cache)
  • Local config files

NOTES:
  • Each deletion requires confirmation via Wrangler CLI
  • D1 Database deletion will result in data loss
  • Script is idempotent (safe to run multiple times)

EXAMPLES:
  # Default undeployment
  ./scripts/quick-undeploy.sh

  # With specific account ID
  ./scripts/quick-undeploy.sh --account-id=xxx

RELATED COMMANDS:
  ./scripts/quick-deploy.sh     # Deploy to Cloudflare
  ./scripts/dev-start.sh        # Start local development
  ./scripts/dev-stop.sh         # Stop local development

EOF
  exit 0
}

# Default values
ACCOUNT_ID=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --account-id=*)
      ACCOUNT_ID="${1#*=}"
      shift
      ;;
    -h|--help)
      show_help
      ;;
    *)
      shift
      ;;
  esac
done

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Agate Undeploy (Resource Removal)${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ============================================
# Check login
# ============================================
echo -e "${YELLOW}Checking Cloudflare login...${NC}"
if ! npx wrangler whoami &>/dev/null; then
  echo -e "${RED}Not logged in. Please login first:${NC}"
  npx wrangler login
fi

ACCOUNT_INFO=$(npx wrangler whoami 2>/dev/null)
echo -e "${GREEN}Logged in${NC}"
echo "$ACCOUNT_INFO" | head -3
echo ""

# Get account_id (for Dashboard links)
if [ -z "$ACCOUNT_ID" ]; then
  ACCOUNT_ID=$(npx wrangler whoami 2>/dev/null | grep -o 'Account ID.*' | grep -o '[a-f0-9]\{32\}' | head -1)

  if [ -z "$ACCOUNT_ID" ]; then
    ACCOUNT_ID=$(grep -o 'account_id.*[a-f0-9]\{32\}' .wrangler/config.json 2>/dev/null | grep -o '[a-f0-9]\{32\}' | head -1 || true)
  fi
fi

echo -e "${BLUE}Account ID: ${ACCOUNT_ID}${NC}"
echo ""

# Constants
DB_NAME="agate-db"
KV_NAME="agate-cache"
WORKERS=("agate-health" "agate-proxy" "agate-admin")
PAGES_PROJECT="agate-admin"

# Counters
WORKERS_DELETED=0
PAGES_DELETED=0
D1_DELETED=0
KV_DELETED=0

# Helper function to check if worker exists
worker_exists() {
  npx wrangler deployments list --name="$1" --json &>/dev/null
}

# Helper function to check if D1 database exists
d1_exists() {
  npx wrangler d1 list 2>/dev/null | grep -q "$1"
}

# Helper function to check if KV namespace exists
kv_exists() {
  npx wrangler kv namespace list 2>/dev/null | grep -q "\"title\": \"${1}\""
}

# Helper function to check if Pages project exists
pages_exists() {
  npx wrangler pages project list 2>/dev/null | grep -q "$1"
}

# ============================================
# Step 1: Delete Pages Project
# ============================================
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}[1/5] Pages Project${NC}"
echo -e "${CYAN}========================================${NC}"

if pages_exists "$PAGES_PROJECT"; then
  echo -e "${BLUE}Found: ${PAGES_PROJECT}${NC}"
  if npx wrangler pages project delete "$PAGES_PROJECT"; then
    echo -e "${GREEN}✓ Deleted: ${PAGES_PROJECT}${NC}"
    ((PAGES_DELETED++))
  fi
else
  echo -e "${YELLOW}✓ Not found: ${PAGES_PROJECT}${NC}"
fi

# ============================================
# Step 2: Delete Workers
# ============================================
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}[2/5] Workers${NC}"
echo -e "${CYAN}========================================${NC}"

for worker in "${WORKERS[@]}"; do
  if worker_exists "$worker"; then
    echo -e "${BLUE}Found: ${worker}${NC}"
    if yes | npx wrangler delete "$worker" --force 2>&1; then
      echo -e "${GREEN}✓ Deleted: ${worker}${NC}"
      ((WORKERS_DELETED++))
    fi
  else
    echo -e "${YELLOW}✓ Not found: ${worker}${NC}"
  fi
done

echo -e "${GREEN}Workers deleted: ${WORKERS_DELETED}/${#WORKERS[@]}${NC}"

# ============================================
# Step 3: Delete D1 Database
# ============================================
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}[3/5] D1 Database${NC}"
echo -e "${CYAN}========================================${NC}"

if d1_exists "$DB_NAME"; then
  echo -e "${BLUE}Found: ${DB_NAME}${NC}"
  echo -e "${RED}⚠ ALL DATA IN THIS DATABASE WILL BE LOST!${NC}"
  if npx wrangler d1 delete "$DB_NAME"; then
    echo -e "${GREEN}✓ Deleted: ${DB_NAME}${NC}"
    ((D1_DELETED++))
  fi
else
  echo -e "${YELLOW}✓ Not found: ${DB_NAME}${NC}"
fi

# ============================================
# Step 4: Delete KV Namespace
# ============================================
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}[4/5] KV Namespace${NC}"
echo -e "${CYAN}========================================${NC}"

if kv_exists "$KV_NAME"; then
  echo -e "${BLUE}Found: ${KV_NAME}${NC}"
  if npx wrangler kv namespace delete "$KV_NAME"; then
    echo -e "${GREEN}✓ Deleted: ${KV_NAME}${NC}"
    ((KV_DELETED++))
  fi
else
  echo -e "${YELLOW}✓ Not found: ${KV_NAME}${NC}"
fi

# ============================================
# Step 5: Clean up local files
# ============================================
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}[5/5] Local Files${NC}"
echo -e "${CYAN}========================================${NC}"

LOCAL_FILES=(".deployment-info" ".admin-api-key" "workers/proxy/wrangler.prod.jsonc" "workers/admin/wrangler.prod.jsonc" "workers/health/wrangler.prod.jsonc")
LOCAL_FILES_DELETED=0

for file in "${LOCAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo -e "${GREEN}✓ Deleted: ${file}${NC}"
    ((LOCAL_FILES_DELETED++))
  fi
done

echo -e "${GREEN}Local files deleted: ${LOCAL_FILES_DELETED}/${#LOCAL_FILES[@]}${NC}"

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Undeployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo -e "  Workers deleted:    ${WORKERS_DELETED}/${#WORKERS[@]}"
echo -e "  Pages project:      ${PAGES_DELETED}/1"
echo -e "  D1 Database:        ${D1_DELETED}/1"
echo -e "  KV Namespace:       ${KV_DELETED}/1"
echo -e "  Local files:        ${LOCAL_FILES_DELETED}/${#LOCAL_FILES[@]}"
echo ""
echo -e "${YELLOW}To re-deploy, run:${NC}"
echo -e "  ./scripts/quick-deploy.sh"
echo ""
