# Agate - Claude 开发规范

## 提交规范

### Commit 前必须完成单元测试

在执行 `/commit` 或创建 git commit 之前，**必须**为新编写的代码添加基本的单元测试。

**验收标准**：
- 新增的核心函数/方法必须有对应的单元测试
- 测试覆盖正常路径和基本错误情况
- `npm test` 必须通过
- 复杂逻辑的覆盖率应达到合理水平

**例外情况**：
- 类型定义文件（`*.d.ts`）
- 配置文件（JSON、JSONC）
- `.gitkeep` 等占位文件

### 测试数据清理要求

所有测试功能**必须**包含数据清理机制，确保测试不产生数据污染。

**运行测试要求**：
- **必须**设置 `TEST_CLEANUP=true` 环境变量运行测试
- 测试完成后通过 `wrangler d1 execute` 命令直接清理数据库
- 测试失败时仍应执行清理逻辑

**正确方式**：
```bash
# 功能测试（必须启用清理）
TEST_CLEANUP=true pnpm test:functional

# 所有测试（必须启用清理）
TEST_CLEANUP=true pnpm test

# 单个测试文件（必须启用清理）
TEST_CLEANUP=true pnpm test tests/functional/auth/auth-flows.test.ts
```

**禁止操作**：
- ❌ 直接运行 `pnpm test`（会留下脏数据）
- ❌ 运行 `pnpm test:functional`（会留下脏数据）

**清理机制**：
- 测试清理 SQL 由 `tests/functional/helpers/cleanup.ts` 生成
- 清理命令通过 `wrangler d1 execute agate-db --local --command="..."` 执行
- 清理规则：删除包含测试特征的数据（13+ 位时间戳 ID、@example.com 邮箱、"Test " 开头的名称等）

**例外情况**：
- 单元测试（使用 mock，不访问真实数据库）
- 集成测试（仅验证函数导出，无数据库操作）

---

## 开发约定

### 通用原则

#### 禁止过度设计

**核心原则**：保持简单，只实现当前需求。

**具体规则**：
- 不为假设的未来需求预留扩展点
- 不添加当前用不到的抽象层或工具函数
- 不为一次性操作创建可复用组件
- 优先使用内置 API 和现有解决方案
- 三行相似代码优于过早抽象
- 仅在系统边界进行校验（用户输入、外部 API）
- 信任内部代码和框架保证

### Cloudflare Workers 限制

#### Bundle 大小限制

Worker 编译后的 WASM bundle 不得超过 **10 MB**。

**原因**：Cloudflare Workers Paid 计划的硬限制为 10 MB（Free 计划仅 3 MB）。

### 开发服务器管理

#### 使用统一脚本启动/停止服务

启动和停止开发服务器**必须**使用项目提供的脚本。

**正确方式**：
```bash
pnpm dev:start    # 启动所有服务（Proxy Worker + Admin Worker + Pages）
pnpm dev:stop     # 停止所有服务
pnpm dev:status   # 查看服务状态
pnpm dev:logs     # 查看日志
```

**禁止操作**：
- ❌ 直接运行 `wrangler dev`（会导致后台进程混乱）
- ❌ 在 pages 目录下直接运行 `pnpm dev`
- ❌ 手动使用 `nohup` 或 `&` 后台启动进程

**原因**：
- 脚本集中管理所有服务进程，自动保存 PID
- 统一日志输出到 `.logs/` 目录
- 一键停止所有服务，自动清理残留进程
- 避免端口占用和进程泄漏

**服务端口**：
- Proxy Worker: `http://localhost:8787`
- Admin Worker: `http://localhost:8788`
- Pages 前端: `http://localhost:5173`

### 生产部署规范

#### 部署前必须确认当前路径

执行任何部署操作前，**必须**通过 `pwd` 确认当前位于项目根目录 `/Users/menfre/Workbench/agate`。

**正确方式**：
```bash
# 1. 确认当前路径
pwd
# 输出应为: /Users/menfre/Workbench/agate

# 2. 如果不在根目录，先切换
cd /Users/menfre/Workbench/agate

# 3. 再执行部署
./scripts/quick-deploy.sh --account-id=xxx
```

**禁止操作**：
- ❌ 在 `workers/proxy`、`workers/admin` 等子目录下执行部署命令
- ❌ 未确认 `pwd` 输出就直接执行部署

**原因**：
- wrangler 会相对当前路径查找配置文件
- 子目录下执行会导致路径错误（如 `workers/proxy/workers/proxy/wrangler.jsonc`）

#### 统一部署脚本

部署到生产环境**必须**使用 `scripts/quick-deploy.sh` 脚本，并使用指定的 Cloudflare 账号。

**正确方式**：
```bash
# 使用指定账号部署
./scripts/quick-deploy.sh --account-id=9302c2040014763012133198c2c42709

# 带自定义域名部署
./scripts/quick-deploy.sh --account-id=9302c2040014763012133198c2c42709 --proxy-domain=api.example.com --admin-domain=admin.example.com
```

**禁止操作**：
- ❌ 直接运行 `wrangler deploy`（会绕过统一配置流程）
- ❌ 使用其他账号 ID 部署（会导致资源分散）
- ❌ 手动创建 D1/KV 资源（脚本已幂等处理）

**原因**：
- 脚本自动创建/复用 D1 数据库、KV 命名空间
- 统一管理 Worker 配置和路由规则
- 自动应用数据库迁移
- 自动初始化 Super Admin API Key
- 幂等设计，可安全重复执行

**部署资源**：
- D1 Database: `agate-db`
- KV Namespace: `agate-cache`
- Proxy Worker: `agate-proxy`
- Admin Worker: `agate-admin`
- Health Worker: `agate-health`
- Admin Frontend: `agate-admin` (Pages)

### Git 工作流
1. 完成功能开发
2. 编写/更新单元测试
3. 运行 `npm test` 确保通过
4. 运行 `npm run typecheck` 确保类型正确
5. 使用 `/commit` 提交代码

### 外部 API 文档查询规范

#### Anthropic API 文档

查询 Anthropic API 文档时，**必须**确保文档版本为 **2026 年或更新**。

**原因**：Anthropic API 快速迭代，旧版本文档可能包含过时的字段格式、事件类型或参数定义，导致代码实现错误。

**正确方式**：
- 优先使用 WebSearch 工具搜索 "Anthropic API Messages 2026" 或 "Anthropic streaming SSE 2026"
- 验证文档 URL 包含最新日期或版本号
- 交叉验证多个来源以确保格式正确

**禁止操作**：
- ❌ 使用 2025 年或更早的文档作为实现依据
- ❌ 假设 SSE 事件格式与旧版本相同
