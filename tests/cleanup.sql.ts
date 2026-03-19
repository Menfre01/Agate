/**
 * Test Data Cleanup SQL Generator
 *
 * Generates SQL for cleaning test data from D1 database.
 * This file is meant to be run directly to generate cleanup SQL.
 *
 * Usage:
 *   npx tsx tests/cleanup.sql.ts > cleanup.sql
 *   wrangler d1 execute ai-gateway-db --local --file=cleanup.sql
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

function generateCleanupSql(): string {
  const statements: string[] = [];

  for (const table of CLEANUP_ORDER) {
    if (table === "users") {
      statements.push(
        `DELETE FROM ${table} WHERE email LIKE '%@example.com' OR email LIKE 'test-%@%' OR email LIKE '%-test-%' OR id REGEXP '.*[0-9]{13,}$';`
      );
    } else if (["companies", "departments", "providers", "models", "api_keys"].includes(table)) {
      statements.push(
        `DELETE FROM ${table} WHERE name LIKE 'Test %' OR name LIKE 'test-%' OR id REGEXP '.*[0-9]{13,}$';`
      );
    } else {
      statements.push(`DELETE FROM ${table} WHERE id REGEXP '.*[0-9]{13,}$';`);
    }
  }

  return statements.join("\n");
}

// 直接运行时输出 SQL
console.log("-- Test Data Cleanup SQL");
console.log("-- Auto-generated - DO NOT EDIT manually");
console.log("");
console.log(generateCleanupSql());
