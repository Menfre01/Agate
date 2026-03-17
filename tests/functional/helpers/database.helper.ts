/**
 * 数据库操作助手
 *
 * 管理测试数据库的生命周期
 *
 * @module tests/functional/helpers/database-helper
 */

import type { Env } from "@/types/index.js";
import * as queries from "@/db/queries.js";
import { readFileSync } from "fs";
import { join } from "path";

// 数据清理顺序（考虑外键约束）
const CLEANUP_ORDER = [
  "usage_logs",
  "quota_changes",
  "api_keys",
  "department_models",
  "models",
  "provider_credentials",
  "providers",
  "users",
  "departments",
  "companies",
] as const;

/**
 * 读取 schema.sql 文件内容
 */
function getSchemaSql(): string {
  // 使用 process.cwd() 获取项目根目录
  const schemaPath = join(process.cwd(), "src/db/schema.sql");
  return readFileSync(schemaPath, "utf-8");
}

/**
 * 初始化测试数据库 schema
 */
export async function setupTestDatabase(env: Env): Promise<void> {
  const schemaSql = getSchemaSql();

  // 分割 SQL 语句并逐条执行
  const statements = schemaSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    try {
      await env.DB.batch([
        env.DB.prepare(statement),
      ]);
    } catch (error) {
      // 忽略索引已存在的错误
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }
  }
}

/**
 * 清理所有测试数据
 * 按外键约束顺序删除
 */
export async function cleanupTestDatabase(env: Env): Promise<void> {
  for (const tableName of CLEANUP_ORDER) {
    await truncateTable(env, tableName);
  }
}

/**
 * 清空指定表
 */
export async function truncateTable(env: Env, tableName: string): Promise<void> {
  const sql = `DELETE FROM ${tableName}`;
  await env.DB.prepare(sql).all();
}

/**
 * 插入测试公司
 */
export async function insertTestCompany(
  env: Env,
  data: {
    id: string;
    name: string;
    quota_pool?: number;
    quota_daily?: number;
  }
): Promise<void> {
  const now = Date.now();
  await queries.createCompany(env.DB, {
    id: data.id,
    name: data.name,
    quota_pool: data.quota_pool ?? 1000000,
    quota_daily: data.quota_daily ?? 10000,
  });
}

/**
 * 插入测试部门
 */
export async function insertTestDepartment(
  env: Env,
  data: {
    id: string;
    company_id: string;
    name: string;
    quota_pool?: number;
    quota_daily?: number;
  }
): Promise<void> {
  await queries.createDepartment(env.DB, {
    id: data.id,
    company_id: data.company_id,
    name: data.name,
    quota_pool: data.quota_pool ?? 500000,
    quota_daily: data.quota_daily ?? 5000,
  });
}

/**
 * 插入测试用户
 */
export async function insertTestUser(
  env: Env,
  data: {
    id: string;
    email: string;
    name?: string;
    company_id: string;
    department_id?: string;
    role?: "admin" | "user";
    quota_daily?: number;
  }
): Promise<void> {
  await queries.createUser(env.DB, {
    id: data.id,
    email: data.email,
    name: data.name ?? "Test User",
    company_id: data.company_id,
    department_id: data.department_id ?? null,
    role: data.role ?? "user",
    quota_daily: data.quota_daily ?? 1000,
  });
}

/**
 * 插入测试供应商
 */
export async function insertTestProvider(
  env: Env,
  data: {
    id: string;
    name: string;
    display_name: string;
    base_url: string;
    api_version?: string;
  }
): Promise<void> {
  await queries.createProvider(env.DB, {
    id: data.id,
    name: data.name,
    display_name: data.display_name,
    base_url: data.base_url,
    api_version: data.api_version ?? "2023-06-01",
  });
}

/**
 * 插入测试模型
 */
export async function insertTestModel(
  env: Env,
  data: {
    id: string;
    model_id: string;
    display_name: string;
    provider_id: string;
    input_price?: number;
    output_price?: number;
    context_window?: number;
    max_tokens?: number;
  }
): Promise<void> {
  await queries.createModel(env.DB, {
    id: data.id,
    model_id: data.model_id,
    display_name: data.display_name,
    provider_id: data.provider_id,
    input_price: data.input_price ?? 0.003,
    output_price: data.output_price ?? 0.015,
    context_window: data.context_window ?? 200000,
    max_tokens: data.max_tokens ?? 4096,
  });
}
