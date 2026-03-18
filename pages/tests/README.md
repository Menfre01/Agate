# Agate-Admin 测试文档

## 测试结构

```
tests/
├── setup.ts                      # 全局测试配置（含清理）
├── vitest.config.ts              # Vitest 配置
├── playwright.config.ts          # Playwright 配置
├── unit/                         # 单元测试
│   ├── components/               # 组件测试
│   └── utils/                    # 工具函数测试
├── integration/                  # 集成测试
│   └── views/                    # 视图集成测试
├── e2e/                          # E2E 测试
│   ├── admin/                    # 管理员流程测试
│   └── fixtures/                 # E2E 测试数据
└── helpers/                      # 测试辅助工具
    ├── test-data.ts              # 测试数据工厂
    └── cleanup.ts                # 清理辅助函数
```

## 运行测试

### 单元测试和集成测试

```bash
# 运行所有测试（必须启用清理）
cd pages && TEST_CLEANUP=true pnpm test

# 运行单元测试
cd pages && TEST_CLEANUP=true pnpm test:unit

# 运行集成测试
cd pages && TEST_CLEANUP=true pnpm test:integration

# 带覆盖率报告
cd pages && TEST_CLEANUP=true pnpm test:coverage

# 带 UI 界面
cd pages && TEST_CLEANUP=true pnpm test:ui
```

### E2E 测试

```bash
# 首次运行需要安装浏览器
cd pages && pnpm test:e2e:install

# 运行 E2E 测试
cd pages && TEST_CLEANUP=true pnpm test:e2e

# 带 UI 界面
cd pages && TEST_CLEANUP=true pnpm test:e2e:ui
```

## 数据清理

所有测试都集成了自动数据清理机制：

- 测试数据通过命名规则匹配清理端点
- `TEST_CLEANUP=true` 环境变量启用清理
- 测试结束后自动调用 `/admin/test/cleanup`

### 测试数据命名规则

测试数据必须遵循以下命名规则以确保被正确清理：

| 字段 | 清理规则 | 示例 |
|------|----------|------|
| ID | 以 13+ 位数字结尾 | `company_1234567890123` |
| 邮箱 | 包含 `@example.com` 或以 `test-` 开头 | `test-123@example.com` |
| 名称 | 以 `Test ` 开头或包含时间戳 | `Test Company 1234567890123` |

### 测试数据工厂

使用 `helpers/test-data.ts` 中的工厂函数生成符合规则的测试数据：

```typescript
import { generateTestEmail, createTestUserData, createTestCompanyData } from '@/tests/helpers/test-data'

const email = generateTestEmail()  // test-1703123456789-abc123@example.com
const company = createTestCompanyData()  // { id: 'company_1703123456789_1', name: 'Test Company 1703123456789_1', ... }
const user = createTestUserData(company.id)  // { email: 'test-1703123456789-def456@example.com', ... }
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TEST_CLEANUP` | 启用数据清理 | `false` (必须设置为 `true`) |
| `TEST_ADMIN_BASE_URL` | Admin Worker 地址 | `http://localhost:8788` |
| `TEST_ADMIN_API_KEY` | 测试用 Admin API Key | `sk-admin_dev_fixed_key_local_2024` |
| `TEST_BASE_URL` | E2E 测试前端地址 | `http://localhost:5173` |

## 编写测试指南

### 单元测试

```typescript
import { describe, it, expect } from 'vitest'

describe('MyFunction', () => {
  it('should do something', () => {
    expect(myFunction()).toBe('expected result')
  })
})
```

### 集成测试

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from '@/components/MyComponent.vue'

describe('MyComponent', () => {
  it('should render correctly', () => {
    const wrapper = mount(MyComponent, {
      global: {
        stubs: { 'n-card': true }
      }
    })
    expect(wrapper.find('.my-class').exists()).toBe(true)
  })
})
```

### E2E 测试

```typescript
import { test, expect } from '@playwright/test'

test('my e2e test', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type="password"]', 'test-key')
  await page.click('button:has-text("登录")')
  await expect(page).toHaveURL(/.*\/admin/)
})
```

## 覆盖率目标

- 单元测试：80%+ 代码覆盖率
- 集成测试：70%+ API 路径覆盖率
- E2E 测试：100% 关键用户流程覆盖
