/**
 * 测试数据工厂
 *
 * 生成符合业务规则的测试数据，支持唯一性约束
 *
 * @module tests/functional/helpers/test-data-factory
 */

import type {
  CreateCompanyDto,
  CreateDepartmentDto,
  CreateUserDto,
  CreateApiKeyDto,
  CreateProviderDto,
  CreateModelDto,
  AddProviderCredentialDto,
} from "@/types/index.js";

let testCounter = 0;

/**
 * 基于时间戳 + 计数器生成唯一 ID
 */
function generateUniqueId(prefix: string): string {
  const timestamp = Date.now();
  const counter = ++testCounter;
  return `${prefix}_${timestamp}_${counter}`;
}

/**
 * 生成唯一测试邮箱
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/**
 * 创建公司数据 DTO
 */
export function createCompanyData(overrides?: Partial<CreateCompanyDto>): CreateCompanyDto {
  return {
    id: generateUniqueId("company"),
    name: generateUniqueId("Test Company"),
    quota_pool: 1000000,
    quota_daily: 10000,
    ...overrides,
  };
}

/**
 * 创建部门数据 DTO
 */
export function createDepartmentData(
  companyId: string,
  overrides?: Partial<CreateDepartmentDto>
): CreateDepartmentDto {
  return {
    id: generateUniqueId("dept"),
    company_id: companyId,
    name: generateUniqueId("Test Department"),
    quota_pool: 500000,
    quota_daily: 5000,
    ...overrides,
  };
}

/**
 * 创建用户数据 DTO
 */
export function createUserData(
  companyId: string,
  departmentId: string | null = null,
  overrides?: Partial<CreateUserDto>
): CreateUserDto {
  return {
    email: generateTestEmail(),
    name: `Test User ${Date.now()}`,
    company_id: companyId,
    department_id: departmentId ?? undefined,
    role: "user",
    quota_daily: 1000,
    ...overrides,
  };
}

/**
 * 创建 API Key 数据 DTO
 */
export function createApiKeyData(
  userId: string,
  companyId: string,
  departmentId: string | null = null,
  overrides?: Partial<CreateApiKeyDto>
): CreateApiKeyDto {
  return {
    user_id: userId,
    name: generateUniqueId("Test API Key"),
    quota_daily: 1000,
    ...overrides,
  };
}

/**
 * 创建供应商数据 DTO
 */
export function createProviderData(overrides?: Partial<CreateProviderDto>): CreateProviderDto {
  return {
    name: generateUniqueId("test-provider"),
    display_name: `Test Provider ${Date.now()}`,
    base_url: "https://api.test.com",
    api_version: "2023-06-01",
    ...overrides,
  };
}

/**
 * 创建模型数据 DTO
 *
 * 注意：模型与供应商现在是 n:n 关系，
 * 需要通过 addModelProvider API 单独添加供应商和定价
 */
export function createModelData(overrides?: Partial<CreateModelDto>): CreateModelDto {
  return {
    model_id: generateUniqueId("test-model"),
    display_name: `Test Model ${Date.now()}`,
    context_window: 200000,
    max_tokens: 4096,
    ...overrides,
  };
}

/**
 * 创建模型-供应商关联数据 DTO
 */
export function createModelProviderData(
  providerId: string,
  overrides?: Partial<{ input_price: number; output_price: number }>
): { provider_id: string; input_price: number; output_price: number } {
  return {
    provider_id: providerId,
    input_price: 0.003,
    output_price: 0.015,
    ...overrides,
  };
}

/**
 * 创建供应商凭证数据 DTO
 */
export function createCredentialData(
  overrides?: Partial<AddProviderCredentialDto>
): AddProviderCredentialDto {
  return {
    credential_name: generateUniqueId("Test Credential"),
    api_key: `sk-test-${Date.now()}-${crypto.randomUUID().replace(/-/g, "")}`,
    priority: 0,
    weight: 1,
    ...overrides,
  };
}

/**
 * 重置测试计数器（用于测试套件之间隔离）
 */
export function resetTestCounter(): void {
  testCounter = 0;
}
