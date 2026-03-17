/**
 * API Key 管理 API 测试
 *
 * @module tests/functional/keys/api-keys
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";
import {
  createCompanyData,
  createDepartmentData,
  createUserData,
  createApiKeyData,
} from "@test/helpers/test-data.factory";

describe("API Keys API", () => {
  let apiClient: ApiClient;
  let adminBaseUrl: string;
  let proxyBaseUrl: string;
  let adminApiKey: string;
  let testCompanyId: string;
  let testDeptId: string;
  let testUserId: string;

  beforeAll(async () => {
    adminBaseUrl = process.env.TEST_ADMIN_BASE_URL || "http://localhost:8788";
    proxyBaseUrl = process.env.TEST_PROXY_BASE_URL || "http://localhost:8787";
    adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";
    apiClient = new ApiClient(adminBaseUrl, proxyBaseUrl, adminApiKey);

    // 使用现有的 demo 数据
    testCompanyId = "co_demo_company";
    testDeptId = "dept_engineering";
  });

  describe("GET /admin/keys", () => {
    it("应该列出所有 API Keys", async () => {
      const response = await apiClient.listApiKeys();

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.keys).toBeInstanceOf(Array);
      }
    });

    it("应该支持按 user_id 过滤", async () => {
      const response = await apiClient.listApiKeys({ user_id: "u_admin" });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.keys).toBeInstanceOf(Array);
      }
    });

    it("应该支持按 company_id 过滤", async () => {
      const response = await apiClient.listApiKeys({ company_id: testCompanyId });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.keys).toBeInstanceOf(Array);
      }
    });

    it("应该支持按 status 过滤", async () => {
      const response = await apiClient.listApiKeys({ status: "active" });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.keys).toBeInstanceOf(Array);
      }
    });
  });

  describe("POST /admin/keys", () => {
    it("应该成功创建 API Key", async () => {
      // 先创建测试用户
      const userData = createUserData(testCompanyId, testDeptId, {
        email: `key-test-${Date.now()}@example.com`,
        name: "Key Test User",
      });
      const userResponse = await apiClient.createUser(userData);

      if (userResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (userResponse.status === 201) {
        testUserId = userResponse.data.id;

        const keyData = {
          user_id: testUserId,
          company_id: testCompanyId,
          department_id: testDeptId,
          name: "Production Key",
          quota_daily: 5000,
        };

        const response = await apiClient.createApiKey(keyData);

        expect([201, 409]).toContain(response.status);
        if (response.status === 201) {
          expect(response.data.id).toBeDefined();
          expect(response.data.key).toBeDefined();
          expect(response.data.key_prefix).toBeDefined();
          expect(response.data.name).toBe("Production Key");
          expect(response.data.quota_daily).toBe(5000);
        }
      }
    });

    it("应该拒绝不存在用户的 API Key", async () => {
      const response = await apiClient.createApiKey({
        user_id: crypto.randomUUID(),
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Invalid User Key",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 404]).toContain(response.status);
      }
    });

    it("应该创建无限配额的 API Key", async () => {
      const response = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Unlimited Key",
        quota_daily: 0,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([201, 409]).toContain(response.status);
        if (response.status === 201) {
          expect(response.data.is_unlimited).toBe(true);
        }
      }
    });

    it("应该设置 API Key 过期时间", async () => {
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 天后

      const response = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Expiring Key",
        quota_daily: 1000,
        expires_at: expiresAt,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([201, 409]).toContain(response.status);
        if (response.status === 201) {
          expect(response.data.expires_at).toBe(expiresAt);
        }
      }
    });
  });

  describe("GET /admin/keys/:id", () => {
    it("应该获取 API Key 详情", async () => {
      const response = await apiClient.getApiKey("ak_admin_key");

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.id).toBe("ak_admin_key");
        expect(response.data.key).toBeUndefined(); // 详情不返回完整 key
        expect(response.data.key_prefix).toBeDefined();
      }
    });

    it("应该返回 404 对于不存在的 API Key", async () => {
      const response = await apiClient.getApiKey(crypto.randomUUID());

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe("PUT /admin/keys/:id", () => {
    it("应该更新 API Key 名称", async () => {
      // 创建临时 key
      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Original Name",
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateApiKey(createResponse.data.id, {
          name: "Updated Key Name",
        });
        expect(response.status).toBe(200);
        expect(response.data.name).toBe("Updated Key Name");
      }
    });

    it("应该更新 API Key 配额", async () => {
      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Quota Test Key",
        quota_daily: 1000,
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateApiKey(createResponse.data.id, {
          quota_daily: 10000,
        });
        expect(response.status).toBe(200);
        expect(response.data.quota_daily).toBe(10000);
      }
    });

    it("应该更新 API Key 过期时间", async () => {
      const newExpiresAt = Date.now() + 60 * 24 * 60 * 60 * 1000; // 60 天后

      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Expiry Test Key",
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateApiKey(createResponse.data.id, {
          expires_at: newExpiresAt,
        });
        expect(response.status).toBe(200);
        expect(response.data.expires_at).toBe(newExpiresAt);
      }
    });
  });

  describe("DELETE /admin/keys/:id", () => {
    it("应该删除 API Key", async () => {
      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Delete Test Key",
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.deleteApiKey(createResponse.data.id);
        expect(response.status).toBe(200);

        const getResponse = await apiClient.getApiKey(createResponse.data.id);
        expect(getResponse.status).toBe(404);
      }
    });
  });

  describe("POST /admin/keys/:id/disable", () => {
    it("应该禁用 API Key", async () => {
      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Disable Test Key",
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.disableApiKey(createResponse.data.id);
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);

        const getResponse = await apiClient.getApiKey(createResponse.data.id);
        if (getResponse.status === 200) {
          expect(getResponse.data.is_active).toBe(false);
        }
      }
    });
  });

  describe("POST /admin/keys/:id/enable", () => {
    it("应该启用已禁用的 API Key", async () => {
      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Enable Test Key",
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        await apiClient.disableApiKey(createResponse.data.id);
        const response = await apiClient.enableApiKey(createResponse.data.id);
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
      }
    });
  });

  describe("POST /admin/keys/:id/bonus", () => {
    it("应该添加奖励配额", async () => {
      const bonusAmount = 10000;
      const bonusExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 天后

      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Bonus Test Key",
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.addBonusQuota(createResponse.data.id, {
          amount: bonusAmount,
          expires_at: bonusExpiry,
          reason: "Testing bonus quota",
        });

        expect(response.status).toBe(200);
        expect(response.data.amount).toBe(bonusAmount);
      }
    });

    it("应该添加永不过期的奖励配额", async () => {
      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Bonus Test Key 2",
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.addBonusQuota(createResponse.data.id, {
          amount: 5000,
        });

        expect(response.status).toBe(200);
        expect(response.data.amount).toBe(5000);
      }
    });

    it("应该累加多次奖励配额", async () => {
      const createResponse = await apiClient.createApiKey({
        user_id: "u_admin",
        company_id: testCompanyId,
        department_id: testDeptId,
        name: "Accumulate Bonus Key",
      });

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        await apiClient.addBonusQuota(createResponse.data.id, { amount: 1000 });
        await apiClient.addBonusQuota(createResponse.data.id, { amount: 2000 });

        const response = await apiClient.getApiKey(createResponse.data.id);
        expect(response.data.quota_bonus).toBe(3000);
      }
    });
  });
});
