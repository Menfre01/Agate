#!/bin/bash
# Agate 开发环境状态检查脚本

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

# PID 文件路径
PROXY_PID_FILE="$PIDS_DIR/proxy.pid"
ADMIN_PID_FILE="$PIDS_DIR/admin.pid"
PAGES_PID_FILE="$PIDS_DIR/pages.pid"

# 端口配置
PROXY_PORT=8787
ADMIN_PORT=8788
PAGES_PORT=5173

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Agate 开发环境状态${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查服务状态
check_service() {
    local name=$1
    local url=$2
    local pid_file=$3
    local log_file=$4

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            # 获取进程运行时间
            local elapsed=$(ps -p "$pid" -o etime= 2>/dev/null | tr -d ' ' || echo "未知")

            # 检查端口是否监听
            local listening="❌"
            if lsof -p "$pid" 2>/dev/null | grep -q "LISTEN.*:${url##*:}"; then
                listening="✓"
            fi

            echo -e "${GREEN}● $name${NC}"
            echo -e "  状态: ${GREEN}运行中${NC}"
            echo -e "  PID: $pid"
            echo -e "  URL: $url"
            echo -e "  端口: ${url##*:} $listening"
            echo -e "  运行时间: $elapsed"
            echo -e "  日志: $log_file"
            echo ""
            return 0
        else
            echo -e "${RED}○ $name${NC}"
            echo -e "  状态: ${RED}已停止${NC} (PID 文件存在但进程不存在)"
            rm -f "$pid_file"
            echo ""
            return 1
        fi
    else
        # 检查端口是否被其他进程占用
        local port_pid=$(lsof -ti ":${url##*:}" 2>/dev/null || true)
        if [ -n "$port_pid" ]; then
            echo -e "${YELLOW}● $name${NC}"
            echo -e "  状态: ${YELLOW}端口被占用${NC}"
            echo -e "  端口: ${url##*:}"
            echo -e "  占用进程 PID: $port_pid"
            echo ""
        else
            echo -e "${RED}○ $name${NC}"
            echo -e "  状态: ${RED}未运行${NC}"
            echo -e "  端口: ${url##*:}"
            echo ""
        fi
        return 1
    fi
}

# 检查所有服务
check_service "Proxy Worker" "http://localhost:$PROXY_PORT" "$PROXY_PID_FILE" "$LOGS_DIR/proxy.log"
check_service "Admin Worker" "http://localhost:$ADMIN_PORT" "$ADMIN_PID_FILE" "$LOGS_DIR/admin.log"
check_service "Pages 开发服务器" "http://localhost:$PAGES_PORT" "$PAGES_PID_FILE" "$LOGS_DIR/pages.log"

# 显示快捷命令
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}快捷命令${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "启动: ${YELLOW}pnpm dev:start${NC}"
echo -e "停止: ${YELLOW}pnpm dev:stop${NC}"
echo -e "状态: ${YELLOW}pnpm dev:status${NC}"
echo -e "日志: ${YELLOW}pnpm dev:logs${NC}"
echo ""
