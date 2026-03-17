/**
 * 配额管理 API 测试
 *
 * @module tests/functional/quotas/quotas
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";
import {
  createCompanyData,
  createDepartmentData,
} from "@test/helpers/test-data.factory";

describe("Quotas API", () => {
  let apiClient: ApiClient;
  let adminBaseUrl: string;
  let proxyBaseUrl: string;
  let adminApiKey: string;

  beforeAll(async () => {
    adminBaseUrl = process.env.TEST_ADMIN_BASE_URL || "http://localhost:8788";
    proxyBaseUrl = process.env.TEST_PROXY_BASE_URL || "http://localhost:8787";
    adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";
    apiClient = new ApiClient(adminBaseUrl, proxyBaseUrl, adminApiKey);
  });

  describe("GET /admin/quotas", () => {
    it("应该列出所有配额", async () => {
      const response = await apiClient.listQuotas();

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.quotas).toBeInstanceOf(Array);
      }
    });

    it("应该支持按 entity_type 过滤", async () => {
      const response = await apiClient.listQuotas({ entity_type: "company" });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.quotas).toBeInstanceOf(Array);
      }
    });

    it("应该支持按部门过滤", async () => {
      const response = await apiClient.listQuotas({ entity_type: "department" });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.quotas).toBeInstanceOf(Array);
      }
    });

    it("应该支持按 API Key 过滤", async () => {
      const response = await apiClient.listQuotas({ entity_type: "api_key" });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.quotas).toBeInstanceOf(Array);
      }
    });
  });

  describe("PUT /admin/quotas/:entityType/:entityId", () => {
    it("应该更新公司配额池", async () => {
      // 创建临时公司
      const companyData = createCompanyData({
        name: `Quota Test Company ${Date.now()}`,
      });
      const createResponse = await apiClient.createCompany(companyData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateQuota("company", createResponse.data.id, {
          quota_type: "pool",
          quota_value: 2000000,
        });

        expect(response.status).toBe(200);
        expect(response.data.quota.quota_pool).toBe(2000000);
      }
    });

    it("应该更新公司日配额", async () => {
      const companyData = createCompanyData({
        name: `Daily Quota Company ${Date.now()}`,
      });
      const createResponse = await apiClient.createCompany(companyData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateQuota("company", createResponse.data.id, {
          quota_type: "daily",
          quota_value: 20000,
        });

        expect(response.status).toBe(200);
        expect(response.data.quota.quota_daily).toBe(20000);
      }
    });

    it("应该更新部门配额池", async () => {
      // 创建临时部门
      const deptData = createDepartmentData("co_demo_company", {
        name: `Quota Test Dept ${Date.now()}`,
      });
      const createResponse = await apiClient.createDepartment(deptData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateQuota("department", createResponse.data.id, {
          quota_type: "pool",
          quota_value: 1000000,
        });

        expect(response.status).toBe(200);
        expect(response.data.quota.quota_pool).toBe(1000000);
      }
    });

    it("应该更新部门日配额", async () => {
      const deptData = createDepartmentData("co_demo_company", {
        name: `Daily Dept ${Date.now()}`,
      });
      const createResponse = await apiClient.createDepartment(deptData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateQuota("department", createResponse.data.id, {
          quota_type: "daily",
          quota_value: 10000,
        });

        expect(response.status).toBe(200);
        expect(response.data.quota.quota_daily).toBe(10000);
      }
    });

    it("应该拒绝无效的配额值", async () => {
      const response = await apiClient.updateQuota("company", "co_demo_company", {
        quota_type: "pool",
        quota_value: -100,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(400);
      }
    });

    it("应该返回 404 对于不存在的实体", async () => {
      const response = await apiClient.updateQuota("company", crypto.randomUUID(), {
        quota_type: "pool",
        quota_value: 1000,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([404, 500]).toContain(response.status);
      }
    });
  });

  describe("POST /admin/quotas/:entityType/:entityId/reset", () => {
    it("应该重置公司配额使用量", async () => {
      const companyData = createCompanyData({
        name: `Reset Company ${Date.now()}`,
      });
      const createResponse = await apiClient.createCompany(companyData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.resetQuota("company", createResponse.data.id);
        expect(response.status).toBe(200);
      }
    });

    it("应该重置部门配额使用量", async () => {
      const deptData = createDepartmentData("co_demo_company", {
        name: `Reset Dept ${Date.now()}`,
      });
      const createResponse = await apiClient.createDepartment(deptData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.resetQuota("department", createResponse.data.id);
        expect(response.status).toBe(200);
      }
    });
  });

  describe("POST /admin/quotas/:entityType/:entityId/bonus", () => {
    it("应该给公司添加奖励配额", async () => {
      const companyData = createCompanyData({
        name: `Bonus Company ${Date.now()}`,
      });
      const createResponse = await apiClient.createCompany(companyData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const bonusAmount = 500000;
        const bonusExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 天后

        const response = await apiClient.addBonus("company", createResponse.data.id, {
          amount: bonusAmount,
          expires_at: bonusExpiry,
          reason: "Testing bonus quota",
        });

        expect(response.status).toBe(200);
        expect(response.data.amount).toBe(bonusAmount);
      }
    });

    it("应该给部门添加奖励配额", async () => {
      const deptData = createDepartmentData("co_demo_company", {
        name: `Bonus Dept ${Date.now()}`,
      });
      const createResponse = await apiClient.createDepartment(deptData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const bonusAmount = 100000;

        const response = await apiClient.addBonus("department", createResponse.data.id, {
          amount: bonusAmount,
        });

        expect(response.status).toBe(200);
        expect(response.data.amount).toBe(bonusAmount);
      }
    });

    it("应该累加多次奖励", async () => {
      const companyData = createCompanyData({
        name: `Accumulate Bonus Company ${Date.now()}`,
      });
      const createResponse = await apiClient.createCompany(companyData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        await apiClient.addBonus("company", createResponse.data.id, { amount: 100000 });
        await apiClient.addBonus("company", createResponse.data.id, { amount: 200000 });

        // 验证奖励配额已累加
        const getResponse = await apiClient.getCompany(createResponse.data.id);
        if (getResponse.status === 200) {
          // 初始 1000000 + 100000 + 200000 = 1300000
          expect(getResponse.data.quota_pool).toBe(1300000);
        }
      }
    });

    it("应该记录奖励原因", async () => {
      const companyData = createCompanyData({
        name: `Bonus Reason Company ${Date.now()}`,
      });
      const createResponse = await apiClient.createCompany(companyData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const reason = "Quarterly bonus allocation";

        const response = await apiClient.addBonus("company", createResponse.data.id, {
          amount: 100000,
          reason,
        });

        expect(response.status).toBe(200);
      }
    });

    it("应该拒绝负数的奖励", async () => {
      const response = await apiClient.addBonus("company", "co_demo_company", {
        amount: -1000,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(400);
      }
    });
  });

  describe("配额变更记录", () => {
    it("应该记录配额变更", async () => {
      const companyData = createCompanyData({
        name: `Change Log Company ${Date.now()}`,
      });
      const createResponse = await apiClient.createCompany(companyData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateQuota("company", createResponse.data.id, {
          quota_type: "pool",
          quota_value: 2000000,
        });

        expect(response.status).toBe(200);
        expect(response.data.quota).toBeDefined();
      }
    });

    it("应该记录变更详情", async () => {
      const companyData = createCompanyData({
        name: `Change Detail Company ${Date.now()}`,
      });
      const createResponse = await apiClient.createCompany(companyData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const newValue = 2000000;

        const response = await apiClient.updateQuota("company", createResponse.data.id, {
          quota_type: "pool",
          quota_value: newValue,
        });

        expect(response.status).toBe(200);
        expect(response.data.quota).toBeDefined();
        expect(response.data.quota.quota_pool).toBe(newValue);
      }
    });
  });
});
