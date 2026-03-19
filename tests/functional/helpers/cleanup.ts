/**
 * Test Data Cleanup Utility
 *
 * Development and test only - directly cleans D1 database.
 *
 * @module tests/functional/helpers/cleanup
 */

// 数据清理顺序（考虑外键约束）
const CLEANUP_ORDER = [
  "usage_logs",
  "quota_changes",
  "department_models",
  "api_keys",
  "models",
  "provider_credentials",
  "providers",
  "users",
  "departments",
  "companies",
] as const;

/**
 * 生成清理 SQL 脚本
 * 识别测试数据特征：
 * 1. IDs 包含 13+ 位时间戳
 * 2. Emails 包含 @example.com
 * 3. Names 以 "Test " 开头或包含 test-
 */
export function generateCleanupSql(): string {
  const statements: string[] = [];

  for (const table of CLEANUP_ORDER) {
    // 根据表类型生成不同的清理条件
    if (table === "users") {
      statements.push(`
-- 清理测试用户
DELETE FROM ${table}
WHERE email LIKE '%@example.com'
   OR email LIKE 'test-%@%'
   OR email LIKE '%-test-%'
   OR id REGEXP '.*[0-9]{13,}$';
      `);
    } else if (["companies", "departments", "providers", "models", "api_keys"].includes(table)) {
      statements.push(`
-- 清理测试 ${table}
DELETE FROM ${table}
WHERE name LIKE 'Test %'
   OR name LIKE '% Test %'
   OR name LIKE 'test-%'
   OR name REGEXP '.*[0-9]{10,}$'
   OR id REGEXP '.*[0-9]{13,}$';
      `);
    } else {
      statements.push(`
-- 清理 ${table}
DELETE FROM ${table} WHERE id REGEXP '.*[0-9]{13,}$';
      `);
    }
  }

  return statements.join("\n");
}

/**
 * 打印清理 SQL 到控制台
 * 可用于手动执行或重定向到文件
 */
export function printCleanupSql(): void {
  console.log("-- Test Data Cleanup SQL");
  console.log("-- Generated at:", new Date().toISOString());
  console.log("");
  console.log(generateCleanupSql());
}

/**
 * 获取清理命令
 * 返回可用于 wrangler d1 execute 的命令
 */
export function getCleanupCommand(dbName: string = "ai-gateway-db"): string {
  const sql = generateCleanupSql();
  // 转义单引号
  const escapedSql = sql.replace(/'/g, "'\"'\"'");
  return `wrangler d1 execute ${dbName} --local --command="${escapedSql}"`;
}
