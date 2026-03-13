#!/bin/bash
# Agate Quick Deploy Script
#
# Fast deployment to Cloudflare Workers with minimal configuration.
#
# Usage: ./scripts/quick-deploy.sh [custom_domain] [account_id]
#
# Example:
#   ./scripts/quick-deploy.sh                                # No custom domain, auto-detect account
#   ./scripts/quick-deploy.sh ai.example.com                 # With custom domain, auto-detect account
#   ./scripts/quick-deploy.sh ai.example.com abc123...       # With custom domain and specific account_id
#   ./scripts/quick-deploy.sh "" abc123...                   # No custom domain, specific account_id

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CUSTOM_DOMAIN="${1:-}"
ACCOUNT_ID="${2:-}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Agate Quick Deploy${NC}"
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
echo -e "\n${YELLOW}[1/5] Setting up D1 Database...${NC}"

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
  wrangler d1 create "$DB_NAME >/dev/null 2>&1" || wrangler d1 create "$DB_NAME"
  DB_ID=$(wrangler d1 list 2>/dev/null | grep -A2 "$DB_NAME" | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
  echo -e "${GREEN}Database created${NC}"
fi

echo -e "${BLUE}Database ID: ${DB_ID}${NC}"

# ============================================
# Step 2: Create KV Namespace (if not exists)
# ============================================
echo -e "\n${YELLOW}[2/5] Setting up KV Cache...${NC}"

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
# Step 3: Create production config
# ============================================
echo -e "\n${YELLOW}[3/5] Creating production config...${NC}"

cat > wrangler.prod.jsonc <<EOF
{
  "name": "agate",
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

# Add custom domain route if provided
if [ -n "$CUSTOM_DOMAIN" ]; then
  # Extract zone name (domain without subdomain)
  ZONE_NAME=$(echo "$CUSTOM_DOMAIN" | sed 's/.*\.\([^.]*\.[^.]*\)$/\1/')
  if [ "$ZONE_NAME" = "$CUSTOM_DOMAIN" ]; then
    ZONE_NAME="$CUSTOM_DOMAIN"
  fi

  # Add routes to config
  TEMP_FILE=$(mktemp)
  jq --arg domain "$CUSTOM_DOMAIN" --arg zone "$ZONE_NAME" \
    '.routes = [{"pattern": "\($domain)/*", "zone_name": "\($zone)"}]' \
    wrangler.prod.jsonc > "$TEMP_FILE"
  mv "$TEMP_FILE" wrangler.prod.jsonc

  echo -e "${GREEN}Custom domain: $CUSTOM_DOMAIN${NC}"
  echo -e "${BLUE}Zone: $ZONE_NAME${NC}"
else
  echo -e "${YELLOW}No custom domain - using *.workers.dev domain${NC}"
fi

echo -e "${GREEN}Config created${NC}"

# ============================================
# Step 4: Deploy database schema
# ============================================
echo -e "\n${YELLOW}[4/5] Deploying database schema...${NC}"

wrangler d1 execute "$DB_NAME" --file=./src/db/schema.sql --config wrangler.prod.jsonc
echo -e "${GREEN}Database schema deployed${NC}"

# Seed initial data (optional, but recommended)
echo -e "${BLUE}Seeding initial data...${NC}"
wrangler d1 execute "$DB_NAME" --file=./scripts/seed-data.sql --config wrangler.prod.jsonc 2>/dev/null || echo -e "${YELLOW}Seed data skipped${NC}"

# ============================================
# Step 5: Deploy Worker
# ============================================
echo -e "\n${YELLOW}[5/5] Deploying Worker...${NC}"

wrangler deploy --config wrangler.prod.jsonc

echo -e "${GREEN}Worker deployed${NC}"

# ============================================
# Summary
# ============================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Get the worker URL
WORKER_URL="https://agate.${ACCOUNT_ID}.workers.dev"

if [ -n "$CUSTOM_DOMAIN" ]; then
  WORKER_URL="https://${CUSTOM_DOMAIN}"
fi

echo -e "\n${BLUE}Your Gateway is live at:${NC}"
echo -e "${GREEN}$WORKER_URL${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Test health check: ${GREEN}curl $WORKER_URL/health${NC}"
echo -e "2. Create admin API key (see scripts/init-dev-keys.sh)"
echo -e "3. Configure your custom domain DNS (if applicable)"

# Save deployment info
cat > .deployment-info <<EOF
# Deployment Information
Date: $(date)
Account ID: $ACCOUNT_ID
Database ID: $DB_ID
KV ID: $KV_ID
Worker URL: $WORKER_URL
EOF

echo -e "\n${BLUE}Deployment info saved to .deployment-info${NC}"
