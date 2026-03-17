/**
 * 认证辅助工具
 *
 * 简化认证测试的辅助函数
 *
 * @module tests/functional/helpers/auth-helper
 */

import type { Env } from "@/types/index.js";
import * as queries from "@/db/queries.js";
import { generateApiKey, hashApiKey, extractKeyPrefix } from "@/utils/crypto.js";
import { generateId } from "@/utils/id-generator.js";

/**
 * 测试用的管理员 API Key 值（固定值，方便测试）
 * 对应的哈希值会在数据库中预先存储
 */
export const TEST_ADMIN_API_KEY = "sk-admin_dev_fixed_key_local_2024";

/**
 * 创建管理员 API Key
 * 返回可用于测试的 API Key 原始值
 */
export async function createAdminApiKey(
  env: Env,
  companyId: string,
  deptId: string
): Promise<string> {
  // 首先创建用户
  const userId = generateId();
  await queries.createUser(env.DB, {
    id: userId,
    email: `admin-${Date.now()}@test.com`,
    name: "Test Admin",
    company_id: companyId,
    department_id: deptId,
    role: "admin",
    quota_daily: 0,
  });

  // 创建 API Key
  const keyValue = TEST_ADMIN_API_KEY + Date.now();
  const keyHash = await hashApiKey(keyValue);
  const keyPrefix = extractKeyPrefix(keyValue);
  const apiKeyId = generateId();

  await queries.createApiKey(env.DB, {
    id: apiKeyId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    user_id: userId,
    company_id: companyId,
    department_id: deptId,
    name: "Test Admin Key",
    quota_daily: 0,
    quota_used: 0,
    quota_bonus: 0,
    is_unlimited: true,
    is_active: true,
    expires_at: null,
  });

  return keyValue;
}

/**
 * 创建测试用户 API Key
 */
export async function createTestApiKey(
  env: Env,
  userId: string,
  companyId: string,
  departmentId: string | null,
  quota: number,
  isUnlimited: boolean = false
): Promise<string> {
  const keyValue = generateApiKey();
  const keyHash = await hashApiKey(keyValue);
  const keyPrefix = extractKeyPrefix(keyValue);
  const apiKeyId = generateId();

  await queries.createApiKey(env.DB, {
    id: apiKeyId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    user_id: userId,
    company_id: companyId,
    department_id: departmentId,
    name: "Test User Key",
    quota_daily: quota,
    quota_used: 0,
    quota_bonus: 0,
    is_unlimited: isUnlimited,
    is_active: true,
    expires_at: null,
  });

  return keyValue;
}

/**
 * 计算 API Key 哈希
 */
export async function computeApiKeyHash(apiKey: string): Promise<string> {
  return hashApiKey(apiKey);
}

/**
 * 获取认证请求头
 */
export function getAuthHeaders(apiKey: string): HeadersInit {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * 获取基本请求头
 */
export function getBasicHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}
