#!/bin/bash
# Agate 开发环境数据清理脚本
# 清理所有测试数据并重置为初始状态

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$PROJECT_ROOT/workers/admin"
DB_DIR="$WORKER_DIR/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
KV_DIR="$WORKER_DIR/.wrangler/state/v3/kv/miniflare-KVNamespaceObject"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Agate 开发环境数据清理${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 显示当前数据状态
echo -e "${YELLOW}当前数据状态：${NC}"
DB_FILE=$(find "$DB_DIR" -name "*.sqlite" -type f 2>/dev/null | head -1)
if [ -n "$DB_FILE" ]; then
    sqlite3 "$DB_FILE" "
        SELECT '  users: ' || COUNT(*) FROM users
        UNION ALL
        SELECT '  companies: ' || COUNT(*) FROM companies
        UNION ALL
        SELECT '  departments: ' || COUNT(*) FROM departments
        UNION ALL
        SELECT '  api_keys: ' || COUNT(*) FROM api_keys
        UNION ALL
        SELECT '  providers: ' || COUNT(*) FROM providers
        UNION ALL
        SELECT '  models: ' || COUNT(*) FROM models
        UNION ALL
        SELECT '  usage_logs: ' || COUNT(*) FROM usage_logs;
    " 2>/dev/null || echo -e "${RED}  无法读取数据库${NC}"
else
    echo -e "${YELLOW}  未找到数据库${NC}"
fi
echo ""

# 确认清理
echo -e "${RED}警告：此操作将删除所有数据并重置为初始状态！${NC}"
echo -n "确认继续？(y/N) "
read -r confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}操作已取消${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}开始清理...${NC}"
echo ""

# 1. 停止所有服务
echo -e "${YELLOW}1. 停止所有服务...${NC}"
bash "$PROJECT_ROOT/scripts/dev-stop.sh" > /dev/null 2>&1
echo -e "${GREEN}✓ 所有服务已停止${NC}"
echo ""

# 2. 删除数据库文件并重新创建
echo -e "${YELLOW}2. 重置数据库...${NC}"

# 删除旧的数据库文件
rm -rf "$DB_DIR"/*.sqlite*
rm -rf "$KV_DIR"/*.sqlite*

echo -e "${GREEN}✓ 旧数据库已删除${NC}"

# 重新创建数据库 (从 admin worker 目录执行)
echo "  执行 schema.sql..."
cd "$WORKER_DIR"
npx wrangler d1 execute ai-gateway-db --local --file="../../packages/shared/src/db/schema.sql" > /dev/null 2>&1

echo "  执行 seed-data.sql..."
npx wrangler d1 execute ai-gateway-db --local --file="../../scripts/seed-data.sql" > /dev/null 2>&1

echo "  执行 seed-system-user.sql..."
npx wrangler d1 execute ai-gateway-db --local --file="../../scripts/seed-system-user.sql" > /dev/null 2>&1

echo "  初始化管理员 API Key..."
node "$PROJECT_ROOT/scripts/init-admin-key.js" --fixed > /dev/null 2>&1

# 返回项目根目录
cd "$PROJECT_ROOT"

echo -e "${GREEN}✓ 数据库已重新初始化${NC}"
echo ""

# 3. 清理日志文件
echo -e "${YELLOW}3. 清理日志文件...${NC}"
LOGS_DIR="$PROJECT_ROOT/.logs"
if [ -d "$LOGS_DIR" ]; then
    rm -f "$LOGS_DIR"/*.log
    echo -e "${GREEN}✓ 日志文件已清理${NC}"
else
    echo -e "${YELLOW}○ 未找到日志目录${NC}"
fi
echo ""

# 4. 清理 PID 文件
echo -e "${YELLOW}4. 清理 PID 文件...${NC}"
PIDS_DIR="$PROJECT_ROOT/.pids"
if [ -d "$PIDS_DIR" ]; then
    rm -f "$PIDS_DIR"/*.pid
    echo -e "${GREEN}✓ PID 文件已清理${NC}"
fi
echo ""

# 5. 显示清理后状态
echo -e "${YELLOW}清理后数据状态：${NC}"
DB_FILE=$(find "$DB_DIR" -name "*.sqlite" -type f 2>/dev/null | head -1)
if [ -n "$DB_FILE" ]; then
    sqlite3 "$DB_FILE" "
        SELECT '  users: ' || COUNT(*) FROM users
        UNION ALL
        SELECT '  companies: ' || COUNT(*) FROM companies
        UNION ALL
        SELECT '  departments: ' || COUNT(*) FROM departments
        UNION ALL
        SELECT '  api_keys: ' || COUNT(*) FROM api_keys
        UNION ALL
        SELECT '  providers: ' || COUNT(*) FROM providers
        UNION ALL
        SELECT '  models: ' || COUNT(*) FROM models;
    " 2>/dev/null || echo -e "${RED}  无法读取数据库${NC}"
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ 数据清理完成${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "使用 ${YELLOW}pnpm dev:start${NC} 启动服务"
echo ""
