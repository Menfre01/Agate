#!/bin/bash
# Agate 开发环境停止脚本
# 停止所有开发服务

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

# PID 文件路径
PROXY_PID_FILE="$PIDS_DIR/proxy.pid"
ADMIN_PID_FILE="$PIDS_DIR/admin.pid"
HEALTH_PID_FILE="$PIDS_DIR/health.pid"
PAGES_PID_FILE="$PIDS_DIR/pages.pid"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Agate 开发环境停止${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 停止函数
stop_service() {
    local name=$1
    local pid_file=$2

    if [ ! -f "$pid_file" ]; then
        echo -e "${YELLOW}○ $name${NC} - PID 文件不存在"
        return 0
    fi

    local pid=$(cat "$pid_file")

    if ps -p "$pid" > /dev/null 2>&1; then
        echo -e "${YELLOW}停止 $name... (PID: $pid)${NC}"
        kill "$pid" 2>/dev/null || true

        # 等待进程结束
        local count=0
        while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
            sleep 1
            count=$((count + 1))
        done

        # 如果还没结束，强制杀死
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${RED}强制停止 $name...${NC}"
            kill -9 "$pid" 2>/dev/null || true
            sleep 1
        fi

        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${RED}✗ $name 停止失败${NC}"
            return 1
        else
            echo -e "${GREEN}✓ $name 已停止${NC}"
            rm -f "$pid_file"
            return 0
        fi
    else
        echo -e "${YELLOW}○ $name${NC} - 进程不存在"
        rm -f "$pid_file"
        return 0
    fi
}

# 停止所有服务
stop_service "Pages 开发服务器" "$PAGES_PID_FILE"
stop_service "Health Worker" "$HEALTH_PID_FILE"
stop_service "Admin Worker" "$ADMIN_PID_FILE"
stop_service "Proxy Worker" "$PROXY_PID_FILE"

# 额外清理：通过端口查找并杀死残留进程
echo ""
echo -e "${BLUE}清理残留进程...${NC}"

cleanup_port() {
    local port=$1
    local name=$2

    local pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}发现端口 $port 上的残留进程，正在清理...${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✓ 已清理端口 $port${NC}"
    fi
}

cleanup_port 5173 "Pages"
cleanup_port 8789 "Health Worker"
cleanup_port 8788 "Admin Worker"
cleanup_port 8787 "Proxy Worker"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 所有服务已停止${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
