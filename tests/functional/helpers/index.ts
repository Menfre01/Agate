/**
 * 功能测试辅助工具入口
 *
 * 统一导出所有测试辅助工具
 *
 * @module tests/functional/helpers
 */

// 测试数据工厂
export {
  createCompanyData,
  createDepartmentData,
  createUserData,
  createApiKeyData,
  createProviderData,
  createModelData,
  createCredentialData,
  generateTestEmail,
  resetTestCounter,
} from "./test-data.factory";

// 数据库操作助手
export {
  setupTestDatabase,
  cleanupTestDatabase,
  truncateTable,
  insertTestCompany,
  insertTestDepartment,
  insertTestUser,
  insertTestProvider,
  insertTestModel,
} from "./database.helper";

// 认证辅助工具
export {
  createAdminApiKey,
  createTestApiKey,
  computeApiKeyHash,
  getAuthHeaders,
  getBasicHeaders,
  TEST_ADMIN_API_KEY,
} from "./auth.helper";

// API 客户端
export { ApiClient } from "./api-client";
export type { ApiResponse } from "./api-client";

// 重新导出集成测试辅助工具
export { createMockEnv } from "../../integration/helpers";
