#!/bin/bash

DB_NAME="agate-db"
DB_ID="ec82e88d-cb98-4cb9-997e-0aabf51b404f"
KV_ID="f07f6a150b4844dc8aa3feb48cd57932"
KV_PREVIEW_ID=""

cat > /tmp/test-minimal.jsonc <<EOF
{
  "name": "agate-proxy",
  "observability": {
    "enabled": true
  }
}
EOF

echo "=== Generated file ==="
cat /tmp/test-minimal.jsonc
