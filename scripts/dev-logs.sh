#!/bin/bash
# Agate 开发环境日志查看脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS_DIR="$PROJECT_ROOT/.logs"

# 日志文件路径
PROXY_LOG_FILE="$LOGS_DIR/proxy.log"
ADMIN_LOG_FILE="$LOGS_DIR/admin.log"
HEALTH_LOG_FILE="$LOGS_DIR/health.log"
PAGES_LOG_FILE="$LOGS_DIR/pages.log"

# 显示帮助
show_help() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Agate 开发环境日志${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "用法: pnpm dev:logs [service] [tail-lines]"
    echo ""
    echo "服务:"
    echo "  proxy    - Proxy Worker 日志"
    echo "  admin    - Admin Worker 日志"
    echo "  health   - Health Worker 日志"
    echo "  pages    - Pages 开发服务器日志"
    echo "  all      - 所有日志 (默认)"
    echo ""
    echo "参数:"
    echo "  tail-lines  - 显示最后 N 行 (默认: 50)"
    echo ""
    echo "示例:"
    echo "  pnpm dev:logs           # 查看所有日志 (最后 50 行)"
    echo "  pnpm dev:logs admin     # 查看 Admin Worker 日志"
    echo "  pnpm dev:logs health    # 查看 Health Worker 日志"
    echo "  pnpm dev:logs proxy 100 # 查看 Proxy Worker 日志 (最后 100 行)"
    echo ""
}

# 解析参数
SERVICE=${1:-all}
LINES=${2:-50}

# 显示日志
show_logs() {
    local name=$1
    local log_file=$2
    local lines=$3

    if [ ! -f "$log_file" ]; then
        echo -e "${YELLOW}○ $name${NC} - 日志文件不存在"
        echo ""
        return
    fi

    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$name 日志 (最后 $lines 行)${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    tail -n "$lines" "$log_file"
    echo ""
}

case "$SERVICE" in
    proxy)
        show_logs "Proxy Worker" "$PROXY_LOG_FILE" "$LINES"
        ;;
    admin)
        show_logs "Admin Worker" "$ADMIN_LOG_FILE" "$LINES"
        ;;
    health)
        show_logs "Health Worker" "$HEALTH_LOG_FILE" "$LINES"
        ;;
    pages)
        show_logs "Pages 开发服务器" "$PAGES_LOG_FILE" "$LINES"
        ;;
    all)
        show_logs "Proxy Worker" "$PROXY_LOG_FILE" "$LINES"
        show_logs "Admin Worker" "$ADMIN_LOG_FILE" "$LINES"
        show_logs "Health Worker" "$HEALTH_LOG_FILE" "$LINES"
        show_logs "Pages 开发服务器" "$PAGES_LOG_FILE" "$LINES"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}错误: 未知服务 '$SERVICE'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
