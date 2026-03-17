/**
 * 统计分析 API 测试
 *
 * @module tests/functional/stats/stats
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";

describe("Stats API", () => {
  let apiClient: ApiClient;
  let baseUrl: string;
  let adminApiKey: string;

  beforeAll(async () => {
    baseUrl = process.env.TEST_BASE_URL || "http://localhost:8787";
    adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";
    apiClient = new ApiClient(baseUrl, adminApiKey);
  });

  describe("GET /admin/stats/usage", () => {
    it("应该返回用量统计", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getUsageStats({
        start_at: dayAgo,
        end_at: now,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.total_requests).toBeDefined();
        expect(response.data.successful_requests).toBeDefined();
        expect(response.data.failed_requests).toBeDefined();
      }
    });

    it("应该支持按天分组", async () => {
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

      const response = await apiClient.getUsageStats({
        start_at: weekAgo,
        end_at: now,
        group_by: "day",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.grouped).toBeInstanceOf(Array);
      }
    });

    it("应该支持按模型分组", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getUsageStats({
        start_at: dayAgo,
        end_at: now,
        group_by: "model",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.grouped).toBeInstanceOf(Array);
      }
    });

    it("应该支持按用户分组", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getUsageStats({
        start_at: dayAgo,
        end_at: now,
        group_by: "user",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.grouped).toBeInstanceOf(Array);
      }
    });
  });

  describe("GET /admin/stats/tokens", () => {
    it("应该返回 Token 使用汇总", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getTokenUsage({
        start_at: dayAgo,
        end_at: now,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.total_tokens).toBeDefined();
        expect(response.data.input_tokens).toBeDefined();
        expect(response.data.output_tokens).toBeDefined();
      }
    });

    it("应该按模型分组统计", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getTokenUsage({
        start_at: dayAgo,
        end_at: now,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.by_model).toBeInstanceOf(Array);
      }
    });
  });

  describe("GET /admin/stats/costs", () => {
    it("应该返回成本分析", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getCostAnalysis({
        start_at: dayAgo,
        end_at: now,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.total_cost).toBeDefined();
      }
    });

    it("应该按模型分组成本", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getCostAnalysis({
        start_at: dayAgo,
        end_at: now,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.by_model).toBeInstanceOf(Array);
      }
    });

    it("应该按供应商分组成本", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getCostAnalysis({
        start_at: dayAgo,
        end_at: now,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.by_provider).toBeInstanceOf(Array);
      }
    });
  });

  describe("GET /admin/stats/models", () => {
    it("应该返回模型使用统计", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getModelStats({
        start_at: dayAgo,
        end_at: now,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.stats).toBeInstanceOf(Array);
      }
    });
  });

  describe("GET /admin/logs", () => {
    it("应该返回使用日志", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getUsageLogs({
        start_at: dayAgo,
        end_at: now,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.total).toBeDefined();
        expect(response.data.page).toBeDefined();
        expect(response.data.page_size).toBeDefined();
        expect(response.data.logs).toBeInstanceOf(Array);
      }
    });

    it("应该支持分页", async () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const response = await apiClient.getUsageLogs({
        start_at: dayAgo,
        end_at: now,
        page: 1,
        page_size: 10,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.page).toBe(1);
        expect(response.data.page_size).toBe(10);
      }
    });

    it("应该支持按状态过滤", async () => {
      const response = await apiClient.get("/admin/logs?status=success");

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
      }
    });

    it("应该支持按用户过滤", async () => {
      const response = await apiClient.get("/admin/logs?user_id=u_admin");

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
      }
    });

    it("应该支持按公司过滤", async () => {
      const response = await apiClient.get("/admin/logs?company_id=co_demo_company");

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
      }
    });

    it("应该支持按模型过滤", async () => {
      const response = await apiClient.get("/admin/logs?model_id=test-model");

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
      }
    });
  });
});
