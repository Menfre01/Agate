#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

export CLOUDFLARE_ACCOUNT_ID="9302c2040014763012133198c2c42709"

# 获取变量
DB_NAME="agate-db"
EXISTING_DB=$(npx wrangler d1 list 2>/dev/null | grep -o "$DB_NAME" || true)

if [ -n "$EXISTING_DB" ]; then
  echo -e "${GREEN}Database '$DB_NAME' already exists${NC}"
  DB_ID=$(npx wrangler d1 list 2>/dev/null | grep "$DB_NAME" | grep -o '[a-f0-9]\{8\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{12\}' | head -1 || echo "")
fi

echo -e "${BLUE}Database ID: ${DB_ID}${NC}"

KV_NAME="agate-cache"
EXISTING_KV=$(npx wrangler kv:namespace list 2>/dev/null | grep -oE "(worker-)?$KV_NAME" || true)

if [ -n "$EXISTING_KV" ]; then
  echo -e "${GREEN}KV namespace '$KV_NAME' already exists${NC}"
  KV_OUTPUT=$(npx wrangler kv:namespace list 2>/dev/null)
  KV_ID=$(echo "$KV_OUTPUT" | grep -B1 "\"title\": \"worker-$KV_NAME\"" | grep -o '"id": "[a-f0-9]\{32\}"' | grep -o '[a-f0-9]\{32\}' | head -1 || echo "")
  KV_PREVIEW_ID=""
fi

echo -e "${BLUE}KV ID: ${KV_ID}${NC}"

echo -e "\n${YELLOW}[3/8] Creating worker configurations...${NC}"

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
}
EOF

echo -e "${GREEN}Worker configs created${NC}"

echo "=== Generated file (last 10 lines) ==="
tail -10 workers/proxy/wrangler.prod.jsonc
