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

### Git 工作流
1. 完成功能开发
2. 编写/更新单元测试
3. 运行 `npm test` 确保通过
4. 运行 `npm run typecheck` 确保类型正确
5. 使用 `/commit` 提交代码
