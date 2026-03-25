<div align="right">

[English](./README.en.md)

</div>

# 功能测试

AI Gateway 的功能测试套件，验证所有管理 API 和代理 API 的端到端行为。

## 目录结构

```
tests/functional/
├── helpers/
│   ├── test-data.factory.ts    # 测试数据工厂
│   ├── database.helper.ts      # 数据库操作助手
│   ├── auth.helper.ts          # 认证辅助工具
│   ├── api-client.ts           # API 客户端封装（支持双 Worker）
│   └── index.ts                # 统一导出
├── organization/
│   ├── companies.test.ts       # 公司管理 API
│   ├── users.test.ts           # 用户管理 API
│   └── departments.test.ts     # 部门管理 API
├── keys/
│   └── api-keys.test.ts        # API Key 管理 API
├── providers/
│   └── providers.test.ts       # 供应商管理 API
├── models/
│   └── models.test.ts          # 模型管理 API
├── stats/
│   └── stats.test.ts           # 统计分析 API
├── quotas/
│   └── quotas.test.ts          # 配额管理 API
├── auth/
│   └── auth-flows.test.ts      # 认证流程测试
├── proxy/
│   └── proxy-api.test.ts       # 代理 API 测试
└── fixtures/
    └── .gitkeep                # 测试 fixture 数据
```

## 运行测试

### 前置条件

1. **启动本地开发服务器**：
   ```bash
   # 同时启动 Proxy 和 Admin Worker
   npm run dev
   ```

   服务地址：
   - **Proxy API:** `http://localhost:8787`
   - **Admin API:** `http://localhost:8788`

2. **设置测试环境变量**（可选）：
   ```bash
   export TEST_ADMIN_BASE_URL="http://localhost:8788"
   export TEST_PROXY_BASE_URL="http://localhost:8787"
   export TEST_ADMIN_API_KEY="sk-your-admin-key"
   ```

### 运行所有功能测试

```bash
npm run test:functional
```

### 运行特定模块的测试

```bash
# 只测试组织管理 API
npm run test:functional -- tests/functional/organization

# 只测试 API Keys
npm run test:functional -- tests/functional/keys

# 只测试认证流程
npm run test:functional -- tests/functional/auth
```

### 运行带 coverage 的测试

```bash
npm run test:functional:coverage
```

## 测试覆盖

### 组织管理 API

- `GET /admin/companies` - 列出所有公司
- `POST /admin/companies` - 创建公司
- `GET /admin/companies/:id` - 获取公司详情
- `PUT /admin/companies/:id` - 更新公司
- `DELETE /admin/companies/:id` - 删除公司
- `GET /admin/users` - 列出用户
- `POST /admin/users` - 创建用户
- `GET /admin/users/:id` - 获取用户详情
- `PUT /admin/users/:id` - 更新用户
- `DELETE /admin/users/:id` - 删除用户
- `GET /admin/departments` - 列出部门
- `POST /admin/departments` - 创建部门
- `GET /admin/departments/:id` - 获取部门详情
- `PUT /admin/departments/:id` - 更新部门
- `DELETE /admin/departments/:id` - 删除部门

### API Key 管理

- `GET /admin/keys` - 列出 API Keys
- `POST /admin/keys` - 创建 API Key
- `GET /admin/keys/:id` - 获取 API Key 详情
- `PUT /admin/keys/:id` - 更新 API Key
- `DELETE /admin/keys/:id` - 删除 API Key
- `POST /admin/keys/:id/disable` - 禁用 API Key
- `POST /admin/keys/:id/enable` - 启用 API Key
- `POST /admin/keys/:id/bonus` - 添加奖励配额

### 供应商管理

- `GET /admin/providers` - 列出供应商
- `POST /admin/providers` - 创建供应商
- `GET /admin/providers/:id` - 获取供应商详情
- `PUT /admin/providers/:id` - 更新供应商
- `DELETE /admin/providers/:id` - 删除供应商
- `POST /admin/providers/:id/credentials` - 添加凭证
- `DELETE /admin/providers/credentials/:id` - 删除凭证

### 模型管理

- `GET /admin/models` - 列出模型
- `POST /admin/models` - 创建模型
- `GET /admin/models/:id` - 获取模型详情
- `PUT /admin/models/:id` - 更新模型
- `DELETE /admin/models/:id` - 删除模型
- `POST /admin/models/:id/providers` - 关联供应商
- `DELETE /admin/models/:id/providers/:provider_id` - 取消关联
- `POST /admin/departments/:id/models` - 设置部门模型权限

### 统计分析

- `GET /admin/stats/usage` - 用量统计
- `GET /admin/stats/tokens` - Token 使用汇总
- `GET /admin/stats/costs` - 成本分析
- `GET /admin/stats/models` - 模型使用统计
- `GET /admin/logs` - 查询使用日志

### 配额管理

- `GET /admin/quotas` - 列出配额
- `PUT /admin/quotas/:entityType/:entityId` - 更新配额
- `POST /admin/quotas/:entityType/:entityId/reset` - 重置配额
- `POST /admin/quotas/:entityType/:entityId/bonus` - 添加奖励配额

### 认证流程

- 无限配额 API Key 验证
- 日配额检查
- 配额池耗尽处理
- API Key 过期处理
- API Key 禁用处理
- KV 缓存策略
- 主动失效机制

### 代理 API

- `GET /v1/models` - 获取可用模型列表
- `POST /v1/messages` - 创建消息请求
- 流式响应处理
- 错误响应记录

## 数据清理策略

每个测试使用 `afterEach` 钩子自动清理测试数据：

1. 按外键约束顺序清空所有表
2. 确保测试之间完全隔离
3. 避免数据残留影响测试结果

## 注意事项

1. **双 Worker 架构**：测试需要同时启动 Proxy 和 Admin Worker
2. **环境变量**：测试通过 `TEST_ADMIN_BASE_URL` 和 `TEST_PROXY_BASE_URL` 配置服务器地址
3. **并发测试**：每个测试独立运行，使用 `singleThread: true` 配置
4. **API Key 安全**：测试用的 API Key 使用已知哈希，不使用真实密钥
