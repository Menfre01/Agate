#!/bin/bash
# Agate 开发环境启动脚本
# 同时启动 Proxy Worker、Admin Worker 和 Pages 开发服务器

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_DIR="$PROJECT_ROOT/.pids"
LOGS_DIR="$PROJECT_ROOT/.logs"

# 确保目录存在
mkdir -p "$PIDS_DIR"
mkdir -p "$LOGS_DIR"

# PID 文件路径
PROXY_PID_FILE="$PIDS_DIR/proxy.pid"
ADMIN_PID_FILE="$PIDS_DIR/admin.pid"
HEALTH_PID_FILE="$PIDS_DIR/health.pid"
PAGES_PID_FILE="$PIDS_DIR/pages.pid"

# 日志文件路径
PROXY_LOG_FILE="$LOGS_DIR/proxy.log"
ADMIN_LOG_FILE="$LOGS_DIR/admin.log"
HEALTH_LOG_FILE="$LOGS_DIR/health.log"
PAGES_LOG_FILE="$LOGS_DIR/pages.log"

# 端口配置
PROXY_PORT=8787
ADMIN_PORT=8788
HEALTH_PORT=8789
PAGES_PORT=5173

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Agate 开发环境启动${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查服务是否已运行
check_running() {
    local name=$1
    local pid_file=$2
    local port=$3

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠ $name 已在运行 (PID: $pid, 端口: $port)${NC}"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi

    # 检查端口是否被占用
    if lsof -i ":$port" > /dev/null 2>&1; then
        local pid=$(lsof -ti ":$port")
        echo -e "${YELLOW}⚠ 端口 $port 已被占用 (PID: $pid)${NC}"
        echo "$pid" > "$pid_file"
        return 0
    fi

    return 1
}

# 启动函数
start_service() {
    local name=$1
    local command=$2
    local pid_file=$3
    local log_file=$4
    local port=$5

    echo -e "${GREEN}启动 $name...${NC}"

    cd "$PROJECT_ROOT"
    nohup bash -c "$command" > "$log_file" 2>&1 &
    local pid=$!

    # 等待进程启动
    sleep 2

    if ps -p "$pid" > /dev/null 2>&1; then
        echo "$pid" > "$pid_file"
        echo -e "${GREEN}✓ $name 已启动 (PID: $pid, 端口: $port)${NC}"
        echo -e "  日志: $log_file"
    else
        echo -e "${RED}✗ $name 启动失败，查看日志: $log_file${NC}"
        cat "$log_file" | tail -20
        return 1
    fi

    echo ""
    return 0
}

# 检查并启动服务
all_started=true

# Proxy Worker
if ! check_running "Proxy Worker" "$PROXY_PID_FILE" "$PROXY_PORT"; then
    if ! start_service "Proxy Worker" \
        "cd workers/proxy && npx wrangler dev --persist-to=.wrangler/state" \
        "$PROXY_PID_FILE" "$PROXY_LOG_FILE" "$PROXY_PORT"; then
        all_started=false
    fi
fi

# Admin Worker
if ! check_running "Admin Worker" "$ADMIN_PID_FILE" "$ADMIN_PORT"; then
    if ! start_service "Admin Worker" \
        "cd workers/admin && npx wrangler dev --persist-to=.wrangler/state" \
        "$ADMIN_PID_FILE" "$ADMIN_LOG_FILE" "$ADMIN_PORT"; then
        all_started=false
    fi
fi

# Health Worker
if ! check_running "Health Worker" "$HEALTH_PID_FILE" "$HEALTH_PORT"; then
    if ! start_service "Health Worker" \
        "cd workers/health && npx wrangler dev --persist-to=.wrangler/state --port=$HEALTH_PORT" \
        "$HEALTH_PID_FILE" "$HEALTH_LOG_FILE" "$HEALTH_PORT"; then
        all_started=false
    fi
fi

# Pages 开发服务器
if ! check_running "Pages 开发服务器" "$PAGES_PID_FILE" "$PAGES_PORT"; then
    if ! start_service "Pages 开发服务器" \
        "cd pages && pnpm dev" \
        "$PAGES_PID_FILE" "$PAGES_LOG_FILE" "$PAGES_PORT"; then
        all_started=false
    fi
fi

# 等待服务完全启动
echo -e "${BLUE}等待服务完全启动...${NC}"
sleep 5

# 显示服务状态
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  服务状态${NC}"
echo -e "${BLUE}========================================${NC}"

show_service_status() {
    local name=$1
    local url=$2
    local pid_file=$3

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${GREEN}● $name${NC} - $url (PID: $pid)"
        else
            echo -e "${RED}○ $name${NC} - 未运行"
            rm -f "$pid_file"
        fi
    else
        echo -e "${RED}○ $name${NC} - 未运行"
    fi
}

show_service_status "Proxy Worker" "http://localhost:$PROXY_PORT" "$PROXY_PID_FILE"
show_service_status "Admin Worker" "http://localhost:$ADMIN_PORT" "$ADMIN_PID_FILE"
show_service_status "Health Worker" "http://localhost:$HEALTH_PORT" "$HEALTH_PID_FILE"
show_service_status "Pages 开发服务器" "http://localhost:$PAGES_PORT" "$PAGES_PID_FILE"

echo ""
echo -e "${BLUE}========================================${NC}"

if [ "$all_started" = true ]; then
    echo -e "${GREEN}✓ 所有服务已启动${NC}"
else
    echo -e "${YELLOW}⚠ 部分服务启动失败，请检查日志${NC}"
fi

echo ""
echo -e "使用 ${YELLOW}pnpm dev:status${NC} 查看状态"
echo -e "使用 ${YELLOW}pnpm dev:stop${NC} 停止所有服务"
echo -e "使用 ${YELLOW}pnpm dev:logs${NC} 查看日志"
echo ""
