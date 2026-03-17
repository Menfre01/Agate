#!/bin/bash
# Agate Quick Deploy Script (Split Worker Architecture)
#
# Fast deployment to Cloudflare Workers with minimal configuration.
# Deploys both Proxy and Admin workers.
#
# Usage: ./scripts/quick-deploy.sh [proxy_domain] [admin_domain] [account_id]
#
# Example:
#   ./scripts/quick-deploy.sh                                            # No custom domain, auto-detect account
#   ./scripts/quick-deploy.sh api.example.com admin.example.com        # With custom domains
#   ./scripts/quick-deploy.sh api.example.com admin.example.com abc... # With domains and account_id
#   ./scripts/quick-deploy.sh "" "" abc123...                           # No custom domains, specific account_id

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROXY_DOMAIN="${1:-}"
ADMIN_DOMAIN="${2:-}"
ACCOUNT_ID="${3:-}"

# If only one argument is provided, it might be the account_id
if [ -n "$PROXY_DOMAIN" ] && [ -z "$ADMIN_DOMAIN" ] && [[ ! "$PROXY_DOMAIN" =~ \. ]]; then
  ACCOUNT_ID="$PROXY_DOMAIN"
  PROXY_DOMAIN=""
  ADMIN_DOMAIN=""
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Agate Quick Deploy (Split Workers)${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if user is logged in to wrangler
echo -e "\n${YELLOW}Checking Cloudflare login...${NC}"
if ! wrangler whoami &>/dev/null; then
  echo -e "${YELLOW}Please login to Cloudflare:${NC}"
  wrangler login
fi

ACCOUNT_INFO=$(wrangler whoami 2>/dev/null)
echo -e "${GREEN}Logged in${NC}"
echo "$ACCOUNT_INFO" | head -3

# Get account_id from parameter or auto-detect
if [ -z "$ACCOUNT_ID" ]; then
  echo -e "\n${YELLOW}No account_id provided, auto-detecting...${NC}"

  # Try to get from wrangler whoami
  ACCOUNT_ID=$(wrangler whoami 2>/dev/null | grep -o 'Account ID.*' | grep -o '[a-f0-9]\{32\}' | head -1)

  # If still empty, try from existing config
  if [ -z "$ACCOUNT_ID" ]; then
    ACCOUNT_ID=$(grep -o 'account_id.*[a-f0-9]\{32\}' .wrangler/config.json 2>/dev/null | grep -o '[a-f0-9]\{32\}' | head -1 || true)
  fi

  # If still empty, prompt user
  if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${YELLOW}Enter your Cloudflare Account ID:${NC}"
    echo "(Find it at https://dash.cloudflare.com -> Workers & Pages -> Overview)"
    read -r ACCOUNT_ID
  fi
fi

echo -e "\n${BLUE}Using Account ID: ${ACCOUNT_ID}${NC}"

# Unique identifier for this deployment
DEPLOY_ID=$(date +%s)
DB_NAME="agate-db"
DB_ID=""
KV_ID=""
KV_PREVIEW_ID=""

# ============================================
# Step 1: Create D1 Database (if not exists)
# ============================================
echo -e "\n${YELLOW}[1/7] Setting up D1 Database...${NC}"

# Check if database already exists
EXISTING_DB=$(wrangler d1 list 2>/dev/null | grep -o "$DB_NAME" || true)

if [ -n "$EXISTING_DB" ]; then
  echo -e "${GREEN}Database '$DB_NAME' already exists${NC}"
  # Get existing database ID
  DB_ID=$(wrangler d1 list 2>/dev/null | grep -A2 "$DB_NAME" | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
  if [ -z "$DB_ID" ]; then
    # Try alternate method to get ID
    DB_ID=$(cat .wrangler/config.json 2>/dev/null | grep -A5 "$DB_NAME" | grep "database_id" | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
  fi
else
  echo -e "${BLUE}Creating D1 database '$DB_NAME'...${NC}"
  wrangler d1 create "$DB_NAME" >/dev/null 2>&1 || wrangler d1 create "$DB_NAME"
  DB_ID=$(wrangler d1 list 2>/dev/null | grep -A2 "$DB_NAME" | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
  echo -e "${GREEN}Database created${NC}"
fi

echo -e "${BLUE}Database ID: ${DB_ID}${NC}"

# ============================================
# Step 2: Create KV Namespace (if not exists)
# ============================================
echo -e "\n${YELLOW}[2/7] Setting up KV Cache...${NC}"

KV_NAME="agate-cache"
EXISTING_KV=$(wrangler kv:namespace list 2>/dev/null | grep -o "$KV_NAME" || true)

if [ -n "$EXISTING_KV" ]; then
  echo -e "${GREEN}KV namespace '$KV_NAME' already exists${NC}"
  KV_ID=$(cat .wrangler/config.json 2>/dev/null | grep -A10 "KV_CACHE" | grep -o '"id": "[a-f0-9]\{32\}"' | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
  KV_PREVIEW_ID=$(cat .wrangler/config.json 2>/dev/null | grep -A10 "KV_CACHE" | grep -o '"preview_id": "[a-f0-9]\{32\}"' | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
else
  echo -e "${BLUE}Creating KV namespace '$KV_NAME'...${NC}"
  wrangler kv:namespace create "$KV_NAME" >/dev/null 2>&1 || wrangler kv:namespace create "$KV_NAME"

  # Get KV IDs from the output
  KV_OUTPUT=$(wrangler kv:namespace create "$KV_NAME" 2>&1)
  KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[a-f0-9]\{32\}"' | grep -o '[a-f0-9]\{32\}' | head -1)
  KV_PREVIEW_ID=$(echo "$KV_OUTPUT" | grep -o 'preview_id = "[a-f0-9]\{32\}"' | grep -o '[a-f0-9]\{32\}' | head -1)
  echo -e "${GREEN}KV namespace created${NC}"
fi

echo -e "${BLUE}KV ID: ${KV_ID}${NC}"

# ============================================
# Step 3: Update Worker Configurations
# ============================================
echo -e "\n${YELLOW}[3/7] Creating worker configurations...${NC}"

# Function to get zone name from domain
get_zone_name() {
  local domain="$1"
  if [ -z "$domain" ]; then
    echo ""
    return
  fi
  # Extract zone name (domain without subdomain)
  local zone=$(echo "$domain" | sed 's/.*\.\([^.]*\.[^.]*\)$/\1/')
  if [ "$zone" = "$domain" ]; then
    echo "$domain"
  else
    echo "$zone"
  fi
}

# Create Proxy Worker config
cat > workers/proxy/wrangler.prod.jsonc <<EOF
{
  "name": "agate-proxy",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "$DB_NAME",
      "database_id": "$DB_ID"
    }
  ],

  "kv_namespaces": [
    {
      "binding": "KV_CACHE",
      "id": "$KV_ID",
      "preview_id": "$KV_PREVIEW_ID"
    }
  ],

  "vars": {
    "ENVIRONMENT": "production"
  },

  "rules": [
    {
      "type": "ESModule",
      "globs": ["**/*.ts"],
      "fallthrough": true
    }
  ],

  "observability": {
    "enabled": true
  }
EOF

# Create Admin Worker config
cat > workers/admin/wrangler.prod.jsonc <<EOF
{
  "name": "agate-admin",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "$DB_NAME",
      "database_id": "$DB_ID"
    }
  ],

  "kv_namespaces": [
    {
      "binding": "KV_CACHE",
      "id": "$KV_ID",
      "preview_id": "$KV_PREVIEW_ID"
    }
  ],

  "vars": {
    "ENVIRONMENT": "production"
  },

  "rules": [
    {
      "type": "ESModule",
      "globs": ["**/*.ts"],
      "fallthrough": true
    }
  ],

  "observability": {
    "enabled": true
  }
EOF

# Add routes to configs if domains are provided
if [ -n "$PROXY_DOMAIN" ]; then
  ZONE_NAME=$(get_zone_name "$PROXY_DOMAIN")
  TEMP_FILE=$(mktemp)
  jq --arg domain "$PROXY_DOMAIN" --arg zone "$ZONE_NAME" \
    '.routes = [{"pattern": "\($domain)/*", "zone_name": "\($zone)"}]' \
    workers/proxy/wrangler.prod.jsonc > "$TEMP_FILE"
  mv "$TEMP_FILE" workers/proxy/wrangler.prod.jsonc
  echo -e "${GREEN}Proxy domain: $PROXY_DOMAIN (zone: $ZONE_NAME)${NC}"
fi

if [ -n "$ADMIN_DOMAIN" ]; then
  ZONE_NAME=$(get_zone_name "$ADMIN_DOMAIN")
  TEMP_FILE=$(mktemp)
  jq --arg domain "$ADMIN_DOMAIN" --arg zone "$ZONE_NAME" \
    '.routes = [{"pattern": "\($domain)/*", "zone_name": "\($zone)"}]' \
    workers/admin/wrangler.prod.jsonc > "$TEMP_FILE"
  mv "$TEMP_FILE" workers/admin/wrangler.prod.jsonc
  echo -e "${GREEN}Admin domain: $ADMIN_DOMAIN (zone: $ZONE_NAME)${NC}"
fi

if [ -z "$PROXY_DOMAIN" ] && [ -z "$ADMIN_DOMAIN" ]; then
  echo -e "${YELLOW}No custom domains - using *.workers.dev domains${NC}"
fi

echo -e "${GREEN}Worker configs created${NC}"

# ============================================
# Step 4: Deploy database schema
# ============================================
echo -e "\n${YELLOW}[4/7] Deploying database schema...${NC}"

# Use proxy worker's config for DB operations
wrangler d1 execute "$DB_NAME" --file=./packages/shared/src/db/schema.sql --config workers/proxy/wrangler.prod.jsonc
echo -e "${GREEN}Database schema deployed${NC}"

# Seed initial data
echo -e "${BLUE}Seeding initial data...${NC}"
wrangler d1 execute "$DB_NAME" --file=./scripts/seed-data.sql --config workers/proxy/wrangler.prod.jsonc 2>/dev/null || echo -e "${YELLOW}Seed data skipped${NC}"

# ============================================
# Step 5: Deploy Proxy Worker
# ============================================
echo -e "\n${YELLOW}[5/7] Deploying Proxy Worker...${NC}"

cd workers/proxy
wrangler deploy --config wrangler.prod.jsonc
cd ../..

echo -e "${GREEN}Proxy Worker deployed${NC}"

# ============================================
# Step 6: Deploy Admin Worker
# ============================================
echo -e "\n${YELLOW}[6/7] Deploying Admin Worker...${NC}"

cd workers/admin
wrangler deploy --config wrangler.prod.jsonc
cd ../..

echo -e "${GREEN}Admin Worker deployed${NC}"

# ============================================
# Step 7: Initialize Super Admin API Key
# ============================================
echo -e "\n${YELLOW}[7/7] Initializing Super Admin API Key...${NC}"

# Run the init script and capture output (use admin worker's config)
INIT_OUTPUT=$(node scripts/init-admin-key.js --prod --config workers/admin/wrangler.prod.jsonc 2>&1)

echo "$INIT_OUTPUT"

# Extract the API key from output
ADMIN_KEY=$(echo "$INIT_OUTPUT" | grep -o 'sk_[0-9]*_[a-f0-9]*' | head -1)

# ============================================
# Summary
# ============================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Get the worker URLs
PROXY_WORKER_URL="https://agate-proxy.${ACCOUNT_ID}.workers.dev"
ADMIN_WORKER_URL="https://agate-admin.${ACCOUNT_ID}.workers.dev"

if [ -n "$PROXY_DOMAIN" ]; then
  PROXY_WORKER_URL="https://${PROXY_DOMAIN}"
fi

if [ -n "$ADMIN_DOMAIN" ]; then
  ADMIN_WORKER_URL="https://${ADMIN_DOMAIN}"
fi

echo -e "\n${BLUE}Your Gateway is live at:${NC}"
echo -e "${GREEN}Proxy:  $PROXY_WORKER_URL${NC}"
echo -e "${GREEN}Admin:  $ADMIN_WORKER_URL${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Test health check: ${GREEN}curl $PROXY_WORKER_URL/health${NC}"
echo -e "2. Test admin access: ${GREEN}curl -H \"x-api-key: $ADMIN_KEY\" $ADMIN_WORKER_URL/admin/keys${NC}"
echo -e "3. Test proxy API: ${GREEN}curl -H \"x-api-key: $ADMIN_KEY\" $PROXY_WORKER_URL/v1/models${NC}"
echo -e "4. Configure your custom domain DNS (if applicable)"
echo -e "\n${RED}IMPORTANT: Save your admin API key!${NC}"
echo -e "${GREEN}$ADMIN_KEY${NC}"
echo -e "${RED}It is also saved in .admin-api-key${NC}"

# Save deployment info
cat > .deployment-info <<EOF
# Deployment Information
Date: $(date)
Account ID: $ACCOUNT_ID
Database ID: $DB_ID
KV ID: $KV_ID
Proxy Worker URL: $PROXY_WORKER_URL
Admin Worker URL: $ADMIN_WORKER_URL
Admin API Key: $ADMIN_KEY
EOF

echo -e "\n${BLUE}Deployment info saved to .deployment-info${NC}"
