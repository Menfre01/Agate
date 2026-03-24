#!/bin/bash
# Agate Quick Deploy Script (Split Worker Architecture)
#
# Fast deployment to Cloudflare Workers with minimal configuration.
# Deploys Proxy, Admin, Health workers and Admin frontend (Pages).
# Uses incremental migrations (wrangler d1 migrations apply) for idempotent DB setup.

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Help function
show_help() {
  cat << 'EOF'
Agate Quick Deploy

Fast deployment to Cloudflare Workers with minimal configuration.

USAGE:
  ./scripts/quick-deploy.sh [OPTIONS]

OPTIONS:
  --proxy-domain=xxx    Custom domain for Proxy Worker (e.g., api.example.com)
  --admin-domain=xxx    Custom domain for Admin Worker (e.g., admin.example.com)
  --account-id=xxx      Cloudflare Account ID (auto-detected if not provided)
  -h, --help            Show this help message

EXAMPLES:
  # Default deployment (workers.dev domains)
  ./scripts/quick-deploy.sh

  # With custom domains
  ./scripts/quick-deploy.sh --proxy-domain=api.example.com --admin-domain=admin.example.com

  # With specific account ID
  ./scripts/quick-deploy.sh --account-id=your-account-id

  # With custom domains and account ID
  ./scripts/quick-deploy.sh --proxy-domain=api.example.com --admin-domain=admin.example.com --account-id=xxx

WHAT GETS DEPLOYED:
  • D1 Database (agate-db)
  • KV Namespace (agate-cache)
  • Proxy Worker (agate-proxy)
  • Admin Worker (agate-admin)
  • Health Worker (agate-health)
  • Admin Frontend (Pages)

RELATED COMMANDS:
  ./scripts/quick-undeploy.sh     # Undeploy all resources
  ./scripts/dev-start.sh          # Start local development
  ./scripts/dev-stop.sh           # Stop local development

EOF
  exit 0
}

# Default values
PROXY_DOMAIN=""
ADMIN_DOMAIN=""
ACCOUNT_ID=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --proxy-domain=*)
      PROXY_DOMAIN="${1#*=}"
      ;;
    --admin-domain=*)
      ADMIN_DOMAIN="${1#*=}"
      ;;
    --account-id=*)
      ACCOUNT_ID="${1#*=}"
      ;;
    -h|--help)
      show_help
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
  shift
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Agate Quick Deploy (Workers + Pages)${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if user is logged in to wrangler
echo -e "\n${YELLOW}Checking Cloudflare login...${NC}"
if ! npx wrangler whoami &>/dev/null; then
  echo -e "${YELLOW}Please login to Cloudflare:${NC}"
  npx wrangler login
fi

ACCOUNT_INFO=$(npx wrangler whoami 2>/dev/null || echo "")
if [ -z "$ACCOUNT_INFO" ]; then
  echo -e "${RED}Failed to get account info${NC}"
  exit 1
fi
echo -e "${GREEN}Logged in${NC}"
echo "$ACCOUNT_INFO" | head -3

# Get account_id from parameter or auto-detect
if [ -z "$ACCOUNT_ID" ]; then
  echo -e "\n${YELLOW}No account_id provided, auto-detecting...${NC}"

  # Try to get from wrangler whoami
  ACCOUNT_ID=$(npx wrangler whoami 2>/dev/null | grep -o 'Account ID.*' | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")

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

# Save project root directory (where this script is located)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PROJECT_ROOT

# Set CLOUDFLARE_ACCOUNT_ID for all wrangler commands
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

# Unique identifier for this deployment
DEPLOY_ID=$(date +%s)
DB_NAME="agate-db"
DB_ID=""
KV_ID=""
KV_PREVIEW_ID=""

# Deployment status tracking
STATUS_D1_DB=0        # 0=pending, 1=success, 2=skipped (exists)
STATUS_KV=0           # 0=pending, 1=success, 2=skipped (exists)
STATUS_MIGRATIONS=0    # 0=pending, 1=success, 2=failed
STATUS_PROXY_WORKER=0  # 0=pending, 1=success, 2=failed
STATUS_ADMIN_WORKER=0  # 0=pending, 1=success, 2=failed
STATUS_HEALTH_WORKER=0 # 0=pending, 1=success, 2=failed
STATUS_PAGES=0        # 0=pending, 1=success, 2=failed
STATUS_ADMIN_KEY=0    # 0=pending, 1=success, 2=failed

PAGES_URL=""

# ============================================
# Step 1: Create D1 Database (if not exists)
# ============================================
echo -e "\n${YELLOW}[1/9] Setting up D1 Database...${NC}"

# Check if database already exists
D1_LIST=$(npx wrangler d1 list 2>/dev/null || echo "")
EXISTING_DB=$(echo "$D1_LIST" | grep -o "$DB_NAME" || true)

if [ -n "$EXISTING_DB" ]; then
  echo -e "${GREEN}Database '$DB_NAME' already exists${NC}"
  STATUS_D1_DB=2  # skipped (exists)
  # Get existing database ID (UUID format) - extract from table output
  DB_ID=$(echo "$D1_LIST" | grep "$DB_NAME" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1 || echo "")
  if [ -z "$DB_ID" ]; then
    # Try alternate method to get ID from config
    DB_ID=$(cat .wrangler/config.json 2>/dev/null | grep -A5 "$DB_NAME" | grep "database_id" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1 || echo "")
  fi
else
  echo -e "${BLUE}Creating D1 database '$DB_NAME'...${NC}"
  if npx wrangler d1 create "$DB_NAME" >/dev/null 2>&1 || npx wrangler d1 create "$DB_NAME"; then
    # Refresh list and get ID
    D1_LIST=$(npx wrangler d1 list 2>/dev/null || echo "")
    DB_ID=$(echo "$D1_LIST" | grep "$DB_NAME" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1 || echo "")
    echo -e "${GREEN}Database created${NC}"
    STATUS_D1_DB=1  # success
  else
    echo -e "${RED}Failed to create database${NC}"
    STATUS_D1_DB=2  # failed
  fi
fi

echo -e "${BLUE}Database ID: ${DB_ID}${NC}"

# ============================================
# Step 2: Create KV Namespace (if not exists)
# ============================================
echo -e "\n${YELLOW}[2/9] Setting up KV Cache...${NC}"

KV_NAME="agate-cache"
# Get KV list as JSON
KV_OUTPUT=$(npx wrangler kv namespace list 2>/dev/null || echo "[]")

# Check for both "agate-cache" and "worker-agate-cache" formats
if echo "$KV_OUTPUT" | grep -q '"title": "worker-'"$KV_NAME"'"'; then
  EXISTING_KV="worker-$KV_NAME"
elif echo "$KV_OUTPUT" | grep -q '"title": "'"$KV_NAME"'"'; then
  EXISTING_KV="$KV_NAME"
else
  EXISTING_KV=""
fi

if [ -n "$EXISTING_KV" ]; then
  echo -e "${GREEN}KV namespace '$KV_NAME' already exists${NC}"
  STATUS_KV=2  # skipped (exists)
  # Extract ID from JSON output
  KV_ID=$(echo "$KV_OUTPUT" | grep -o '"id": "[a-f0-9]\{32\}"' | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
  KV_PREVIEW_ID=$(cat .wrangler/config.json 2>/dev/null | grep -A10 "KV_CACHE" | grep -o '"preview_id": "[a-f0-9]\{32\}"' | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
else
  echo -e "${BLUE}Creating KV namespace '$KV_NAME'...${NC}"
  if npx wrangler kv namespace create "$KV_NAME" >/dev/null 2>&1 || npx wrangler kv namespace create "$KV_NAME"; then
    # Refresh KV list to get the ID
    KV_OUTPUT=$(npx wrangler kv namespace list 2>/dev/null || echo "")
    # Parse JSON output - wrangler uses spaces around colons in JSON output
    KV_ID=$(echo "$KV_OUTPUT" | grep -o '"id": "[a-f0-9]\{32\}"' | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")

    # Create preview namespace
    npx wrangler kv namespace create "$KV_NAME" --preview >/dev/null 2>&1 || true
    KV_PREVIEW_OUTPUT=$(npx wrangler kv namespace list 2>/dev/null || echo "")
    # For preview, we need to find the one with preview in title or use a different approach
    # Let's use the wrangler config approach
    wrangler kv namespace list 2>/dev/null > /tmp/kv_list.txt || true

    echo -e "${GREEN}KV namespace created${NC}"
    STATUS_KV=1  # success
  else
    echo -e "${RED}Failed to create KV namespace${NC}"
    STATUS_KV=2  # failed
  fi
fi

echo -e "${BLUE}KV ID: ${KV_ID}${NC}"

# ============================================
# Step 3: Update Worker Configurations
# ============================================
echo -e "\n${YELLOW}[3/9] Creating worker configurations...${NC}"

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
cat > workers/proxy/wrangler.prod.jsonc <<_CONFIG_EOF_
{
  "name": "agate-proxy",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "$DB_NAME",
      "database_id": "$DB_ID",
      "migrations_dir": "../../migrations"
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
}
_CONFIG_EOF_

# Debug: check generated file
echo "DEBUG: Proxy config file last 5 lines:"
tail -5 workers/proxy/wrangler.prod.jsonc

# Create Admin Worker config
cat > workers/admin/wrangler.prod.jsonc <<_CONFIG_EOF_
{
  "name": "agate-admin",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "$DB_NAME",
      "database_id": "$DB_ID",
      "migrations_dir": "../../migrations"
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
}
_CONFIG_EOF_

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
# Step 4: Apply database migrations (idempotent)
# ============================================
echo -e "\n${YELLOW}[4/9] Applying database migrations...${NC}"

# Use wrangler d1 migrations apply for idempotent incremental migrations
# This will track applied migrations and only run new ones
if npx wrangler d1 migrations apply "$DB_NAME" --remote --config workers/proxy/wrangler.prod.jsonc 2>&1; then
  echo -e "${GREEN}Database migrations applied${NC}"
  STATUS_MIGRATIONS=1  # success
else
  echo -e "${RED}Failed to apply database migrations${NC}"
  STATUS_MIGRATIONS=2  # failed
fi

# ============================================
# Step 5: Deploy Proxy Worker
# ============================================
echo -e "\n${YELLOW}[5/9] Deploying Proxy Worker...${NC}"

cd workers/proxy || { echo -e "${RED}Failed to enter workers/proxy directory${NC}"; STATUS_PROXY_WORKER=2; cd ../..; }

if [ "$STATUS_PROXY_WORKER" != "2" ]; then
  if npx wrangler deploy --config wrangler.prod.jsonc 2>&1; then
    cd ../..
    echo -e "${GREEN}Proxy Worker deployed${NC}"
    STATUS_PROXY_WORKER=1  # success
  else
    cd ../..
    echo -e "${RED}Failed to deploy Proxy Worker${NC}"
    STATUS_PROXY_WORKER=2  # failed
  fi
fi

# ============================================
# Step 6: Deploy Admin Worker
# ============================================
echo -e "\n${YELLOW}[6/9] Deploying Admin Worker...${NC}"

cd workers/admin || { echo -e "${RED}Failed to enter workers/admin directory${NC}"; STATUS_ADMIN_WORKER=2; cd ../..; }

if [ "$STATUS_ADMIN_WORKER" != "2" ]; then
  if npx wrangler deploy --config wrangler.prod.jsonc 2>&1; then
    cd ../..
    echo -e "${GREEN}Admin Worker deployed${NC}"
    STATUS_ADMIN_WORKER=1  # success
  else
    cd ../..
    echo -e "${RED}Failed to deploy Admin Worker${NC}"
    STATUS_ADMIN_WORKER=2  # failed
  fi
fi

# ============================================
# Step 7: Deploy Health Worker
# ============================================
echo -e "\n${YELLOW}[7/9] Deploying Health Worker...${NC}"

# Create Health Worker config
cat > workers/health/wrangler.prod.jsonc <<EOF
{
  "name": "agate-health",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "$DB_NAME",
      "database_id": "$DB_ID",
      "migrations_dir": "../../migrations"
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
    "ENVIRONMENT": "production",
    "SYSTEM_USER_ID": "sys-health-user",
    "SYSTEM_COMPANY_ID": "sys-health"
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
  },

  "triggers": {
    "crons": ["*/5 * * * *"]
  }
}
EOF

cd workers/health || { echo -e "${RED}Failed to enter workers/health directory${NC}"; STATUS_HEALTH_WORKER=2; cd ../..; }

if [ "$STATUS_HEALTH_WORKER" != "2" ]; then
  if npx wrangler deploy --config wrangler.prod.jsonc 2>&1; then
    cd ../..
    echo -e "${GREEN}Health Worker deployed (cron: */5 * * * *)${NC}"
    STATUS_HEALTH_WORKER=1  # success
  else
    cd ../..
    echo -e "${RED}Failed to deploy Health Worker${NC}"
    STATUS_HEALTH_WORKER=2  # failed
  fi
fi

# ============================================
# Step 7.5: Update Pages environment variables
# ============================================
echo -e "\n${YELLOW}[7.5/9] Updating Pages environment configuration...${NC}"

# Construct the Admin Worker URL
if [ -n "$ADMIN_DOMAIN" ]; then
  ADMIN_WORKER_URL="https://${ADMIN_DOMAIN}"
else
  ADMIN_WORKER_URL="https://agate-admin.${ACCOUNT_ID}.workers.dev"
fi

# Update .env.production with actual Worker URLs
cat > pages/.env.production <<EOF
# API Base URLs (生产环境)
# Admin Worker - 管理员 API
VITE_ADMIN_WORKER_URL=${ADMIN_WORKER_URL}

# User Worker - 用户 API (当前与 Admin Worker 共享)
VITE_USER_WORKER_URL=${ADMIN_WORKER_URL}
EOF

echo -e "${GREEN}Environment configuration updated${NC}"
echo -e "${BLUE}Admin Worker URL: ${ADMIN_WORKER_URL}${NC}"

# ============================================
# Step 8: Deploy Admin Frontend (Pages)
# ============================================
echo -e "\n${YELLOW}[8/10] Deploying Admin Frontend (Pages)...${NC}"

# Build the frontend
echo -e "${BLUE}Building frontend...${NC}"
cd pages || { echo -e "${RED}Failed to enter pages directory${NC}"; STATUS_PAGES=2; }

if [ "$STATUS_PAGES" != "2" ]; then
  if pnpm build --silent 2>/dev/null; then
    BUILD_SUCCESS=true
  elif pnpm build 2>&1; then
    BUILD_SUCCESS=true
  else
    BUILD_SUCCESS=false
  fi

  if [ "$BUILD_SUCCESS" = "true" ]; then
    # Create Pages project if it doesn't exist
    echo -e "${BLUE}Ensuring Pages project exists...${NC}"
    npx wrangler pages project create agate-admin --production-branch=main 2>/dev/null || true

    # Deploy to Cloudflare Pages
    echo -e "${BLUE}Deploying to Cloudflare Pages...${NC}"
    PAGES_OUTPUT=$(npx wrangler pages deploy dist --project-name=agate-admin --commit-dirty=true 2>&1 || echo "DEPLOY_FAILED")
    PAGES_URL=$(echo "$PAGES_OUTPUT" | grep -oE 'https://[a-z0-9.-]+\.pages\.dev' | head -1 || echo "")

    cd ../..

    if echo "$PAGES_OUTPUT" | grep -q "DEPLOY_FAILED"; then
      echo -e "${RED}Failed to deploy to Cloudflare Pages${NC}"
      STATUS_PAGES=2  # failed
    elif [ -n "$PAGES_URL" ]; then
      echo -e "${GREEN}Admin Frontend deployed${NC}"
      echo -e "${BLUE}Pages URL: ${PAGES_URL}${NC}"
      STATUS_PAGES=1  # success
    else
      echo -e "${YELLOW}Admin Frontend deployed (URL not found in output)${NC}"
      STATUS_PAGES=1  # success (deployed but URL parsing failed)
    fi
  else
    cd ../..
    echo -e "${RED}Failed to build Admin Frontend${NC}"
    STATUS_PAGES=2  # failed
  fi
else
  cd ../..
fi

# ============================================
# Step 9: Initialize Super Admin API Key (idempotent)
# ============================================
echo -e "\n${YELLOW}[9/10] Initializing Super Admin API Key...${NC}"

# Check if admin key file already exists (from previous deployment)
if [ -f .admin-api-key ]; then
  ADMIN_KEY=$(cat .admin-api-key || echo "")
  echo -e "${GREEN}Admin API Key already exists${NC}"
  echo -e "${BLUE}Key Prefix: ${ADMIN_KEY:0:12}...${NC}"
  STATUS_ADMIN_KEY=1  # success
else
  # Run the init script and capture output (use admin worker's config, with remote flag)
  # Use PROJECT_ROOT for correct path resolution
  INIT_OUTPUT=$(node "$PROJECT_ROOT/scripts/init-admin-key.js" --prod --config "$PROJECT_ROOT/workers/admin/wrangler.prod.jsonc" --remote 2>&1 || echo "")

  echo "$INIT_OUTPUT"

  # Extract the API key from output (only if newly created)
  ADMIN_KEY=$(echo "$INIT_OUTPUT" | grep -o 'sk_[0-9]*_[a-f0-9]*' | head -1 || echo "")

  # If extraction failed but output says key exists, try reading from file
  if [ -z "$ADMIN_KEY" ] && echo "$INIT_OUTPUT" | grep -q "already exists"; then
    ADMIN_KEY=$(cat .admin-api-key 2>/dev/null || echo "")
  fi

  if [ -n "$ADMIN_KEY" ]; then
    STATUS_ADMIN_KEY=1  # success
  else
    echo -e "${RED}Failed to initialize Admin API Key${NC}"
    STATUS_ADMIN_KEY=2  # failed
  fi
fi

# ============================================
# Summary
# ============================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}========================================${NC}"

# Helper function to show status
show_status() {
  local name="$1"
  local status="$2"
  case $status in
    0) echo -e "${YELLOW}⏳ ${name}: Pending${NC}" ;;
    1) echo -e "${GREEN}✓ ${name}: Success${NC}" ;;
    2) echo -e "${RED}✗ ${name}: Failed${NC}" ;;
    *) echo -e "${BLUE}○ ${name}: Skipped (exists)${NC}" ;;
  esac
}

echo ""
echo -e "${BLUE}Resource Status:${NC}"
show_status "D1 Database ($DB_NAME)" "$STATUS_D1_DB"
show_status "KV Namespace ($KV_NAME)" "$STATUS_KV"
show_status "Database Migrations" "$STATUS_MIGRATIONS"
show_status "Proxy Worker" "$STATUS_PROXY_WORKER"
show_status "Admin Worker" "$STATUS_ADMIN_WORKER"
show_status "Health Worker" "$STATUS_HEALTH_WORKER"
show_status "Admin Frontend (Pages)" "$STATUS_PAGES"
show_status "Admin API Key" "$STATUS_ADMIN_KEY"

# Count failures
FAILURES=0
[ "$STATUS_D1_DB" = "2" ] && ((FAILURES++))
[ "$STATUS_KV" = "2" ] && ((FAILURES++))
[ "$STATUS_MIGRATIONS" = "2" ] && ((FAILURES++))
[ "$STATUS_PROXY_WORKER" = "2" ] && ((FAILURES++))
[ "$STATUS_ADMIN_WORKER" = "2" ] && ((FAILURES++))
[ "$STATUS_HEALTH_WORKER" = "2" ] && ((FAILURES++))
[ "$STATUS_PAGES" = "2" ] && ((FAILURES++))
[ "$STATUS_ADMIN_KEY" = "2" ] && ((FAILURES++))

echo ""
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}All resources deployed successfully!${NC}"
  echo -e "${GREEN}========================================${NC}"
else
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}${FAILURES} resource(s) failed to deploy${NC}"
  echo -e "${RED}========================================${NC}"
  echo -e "${YELLOW}This deployment is idempotent - you can safely run it again to retry failed resources.${NC}"
fi

# Show URLs only if deployments succeeded
echo ""
if [ "$STATUS_PROXY_WORKER" = "1" ] || [ "$STATUS_ADMIN_WORKER" = "1" ] || [ "$STATUS_HEALTH_WORKER" = "1" ] || [ "$STATUS_PAGES" = "1" ]; then
  echo -e "${BLUE}Deployed URLs:${NC}"

  # Get the worker URLs
  PROXY_WORKER_URL="https://agate-proxy.${ACCOUNT_ID}.workers.dev"
  ADMIN_WORKER_URL="https://agate-admin.${ACCOUNT_ID}.workers.dev"

  if [ -n "$PROXY_DOMAIN" ]; then
    PROXY_WORKER_URL="https://${PROXY_DOMAIN}"
  fi

  if [ -n "$ADMIN_DOMAIN" ]; then
    ADMIN_WORKER_URL="https://${ADMIN_DOMAIN}"
  fi

  [ "$STATUS_PROXY_WORKER" = "1" ] && echo -e "${GREEN}Proxy:  ${PROXY_WORKER_URL}${NC}"
  [ "$STATUS_ADMIN_WORKER" = "1" ] && echo -e "${GREEN}Admin:  ${ADMIN_WORKER_URL}${NC}"
  [ "$STATUS_HEALTH_WORKER" = "1" ] && echo -e "${GREEN}Health: https://agate-health.${ACCOUNT_ID}.workers.dev (cron)${NC}"

  if [ "$STATUS_PAGES" = "1" ]; then
    if [ -n "$PAGES_URL" ]; then
      echo -e "${GREEN}Frontend: ${PAGES_URL}${NC}"
    else
      echo -e "${GREEN}Frontend: https://agate-admin.pages.dev${NC}"
    fi
  fi
fi

# Show next steps if key is available
if [ -n "$ADMIN_KEY" ]; then
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo -e "1. Test health check: ${GREEN}curl ${PROXY_WORKER_URL}/health${NC}"
  echo -e "2. Test admin access: ${GREEN}curl -H \"x-api-key: ${ADMIN_KEY}\" ${ADMIN_WORKER_URL}/admin/keys${NC}"
  echo -e "3. Test proxy API: ${GREEN}curl -H \"x-api-key: ${ADMIN_KEY}\" ${PROXY_WORKER_URL}/v1/models${NC}"
  if [ "$STATUS_PAGES" = "1" ]; then
    echo -e "4. Open admin frontend: ${GREEN}https://agate-admin.pages.dev${NC}"
  fi
  echo -e "5. Configure your custom domain DNS (if applicable)"
  echo ""
  echo -e "${RED}IMPORTANT: Save your admin API key!${NC}"
  echo -e "${GREEN}${ADMIN_KEY}${NC}"
  echo -e "${RED}It is also saved in .admin-api-key${NC}"
fi

# Show retry message if there were failures
if [ $FAILURES -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}To retry failed resources, run again:${NC}"
  echo -e "${GREEN}./scripts/quick-deploy.sh${NC}"
fi

# Save deployment info
if [ -n "$PAGES_URL" ]; then
  PAGES_INFO_URL="$PAGES_URL"
else
  PAGES_INFO_URL="https://agate-admin.pages.dev"
fi

cat > .deployment-info <<EOF
# Deployment Information
Date: $(date)
Account ID: $ACCOUNT_ID
Database ID: $DB_ID
KV ID: $KV_ID
Proxy Worker URL: $PROXY_WORKER_URL
Admin Worker URL: $ADMIN_WORKER_URL
Health Worker URL: https://agate-health.${ACCOUNT_ID}.workers.dev
Admin Frontend URL: $PAGES_INFO_URL
Admin API Key: $ADMIN_KEY
EOF

echo -e "\n${BLUE}Deployment info saved to .deployment-info${NC}"
