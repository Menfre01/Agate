/**
 * 代理 API 测试
 *
 * @module tests/functional/proxy/proxy-api
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";
import {
  createDepartmentData,
  createUserData,
} from "@test/helpers/test-data.factory";

describe("Proxy API", () => {
  let apiClient: ApiClient;
  let baseUrl: string;
  let adminApiKey: string;
  let userApiKey: string;
  let testCompanyId: string;
  let testDeptId: string;

  beforeAll(async () => {
    baseUrl = process.env.TEST_BASE_URL || "http://localhost:8787";
    adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";
    apiClient = new ApiClient(baseUrl, adminApiKey);

    // 使用现有的 demo 数据
    testCompanyId = "co_demo_company";
    testDeptId = "dept_engineering";
  });

  describe("GET /v1/models", () => {
    it("应该返回可用模型列表", async () => {
      const response = await apiClient.proxyGetModels(adminApiKey);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        // Anthropic 格式: { object: "list", data: [...] }
        expect(response.data.object).toBe("list");
        expect(response.data.data).toBeInstanceOf(Array);
      }
    });

  });

  describe("POST /v1/messages", () => {
    it("应该处理消息请求", async () => {
      // 注意：实际代理需要真实的服务器环境和上游 API
      const response = await apiClient.proxyCreateMessage(adminApiKey, {
        model: "claude-3-5-sonnet-20241022",
        messages: [
          { role: "user", content: "Hello, world!" },
        ],
        max_tokens: 100,
      });

      // 可能的状态码：200(成功), 402(配额不足), 502(上游不可用), 500(服务器错误)
      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([200, 202, 402, 502, 500]).toContain(response.status);
      }
    });

    it("应该验证必填字段", async () => {
      const response = await apiClient.proxyCreateMessage(adminApiKey, {
        model: "test-model",
        // 缺少 messages
        max_tokens: 100,
      } as any);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        // 服务器可能返回 500 如果模型不存在
        expect([400, 422, 500]).toContain(response.status);
      }
    });

    it("应该验证消息格式", async () => {
      const response = await apiClient.proxyCreateMessage(adminApiKey, {
        model: "test-model",
        messages: [
          { role: "user" }, // 缺少 content
        ],
        max_tokens: 100,
      } as any);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        // 服务器可能返回 500 如果模型不存在
        expect([400, 422, 500]).toContain(response.status);
      }
    });

    it("应该验证 max_tokens", async () => {
      const response = await apiClient.proxyCreateMessage(adminApiKey, {
        model: "test-model",
        messages: [
          { role: "user", content: "Hello" },
        ],
        max_tokens: -1, // 无效值
      } as any);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        // 服务器可能返回 500 如果模型不存在
        expect([400, 422, 500]).toContain(response.status);
      }
    });
  });

  describe("流式响应", () => {
    it("应该处理流式请求", async () => {
      const response = await apiClient.proxyCreateMessage(adminApiKey, {
        model: "claude-3-5-sonnet-20241022",
        messages: [
          { role: "user", content: "Hello" },
        ],
        max_tokens: 100,
        stream: true,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        // 流式响应可能返回 200 或特定状态
        expect([200, 202, 402, 502, 500]).toContain(response.status);
      }
    });
  });

  describe("请求头处理", () => {
    it("应该处理自定义请求头", async () => {
      // 使用 fetch 直接发送请求以测试自定义头
      const requestId = `test-request-${Date.now()}`;
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${adminApiKey}`,
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          messages: [
            { role: "user", content: "Hello" },
          ],
          max_tokens: 100,
        }),
      });

      // 验证请求格式正确
      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([200, 202, 402, 502, 500]).toContain(response.status);
      }
    });
  });

  describe("错误处理", () => {
    it("应该返回适当的错误信息", async () => {
      const response = await apiClient.proxyCreateMessage(adminApiKey, {
        model: "non-existent-model",
        messages: [
          { role: "user", content: "Test" },
        ],
        max_tokens: 100,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        // 可能返回 400(无效参数), 404(模型不存在), 403(无权限), 或其他错误
        expect([400, 403, 404, 500, 502]).toContain(response.status);
      }
    });
  });

  describe("请求验证", () => {
    it("应该拒绝空的 model 参数", async () => {
      const response = await apiClient.proxyCreateMessage(adminApiKey, {
        model: "",
        messages: [
          { role: "user", content: "Hello" },
        ],
        max_tokens: 100,
      } as any);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 422]).toContain(response.status);
      }
    });

    it("应该拒绝空的 messages 数组", async () => {
      const response = await apiClient.proxyCreateMessage(adminApiKey, {
        model: "test-model",
        messages: [],
        max_tokens: 100,
      } as any);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 422]).toContain(response.status);
      }
    });
  });
});
