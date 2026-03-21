#!/bin/bash

# 设置变量
DB_NAME="agate-db"
DB_ID="ec82e88d-cb98-4cb9-997e-0aabf51b404f"
KV_ID="f07f6a150b4844dc8aa3feb48cd57932"
KV_PREVIEW_ID=""

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[3/8] Creating worker configurations...${NC}"

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

# 检查生成的文件
echo "=== Generated file (last 10 lines) ==="
tail -10 workers/proxy/wrangler.prod.jsonc
