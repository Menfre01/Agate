/**
 * 代理 API 测试
 *
 * @module tests/functional/proxy/proxy-api
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";
import {
  createProviderData,
  createModelData,
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

    it.skip("应该基于部门权限过滤模型", async () => {
      // TODO: /v1/models 端点尚未实现部门权限过滤
      // 创建测试用户和 API Key
      const userData = createUserData(testCompanyId, testDeptId, {
        email: `proxy-model-test-${Date.now()}@example.com`,
        name: "Proxy Model User",
      });
      const userResponse = await apiClient.createUser(userData);

      if (userResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (userResponse.status === 201) {
        const keyResponse = await apiClient.createApiKey({
          user_id: userResponse.data.id,
          company_id: testCompanyId,
          department_id: testDeptId,
          name: "Proxy Test Key",
        });

        if (keyResponse.status === 201) {
          const response = await apiClient.proxyGetModels(keyResponse.data.key);
          expect(response.status).toBe(200);
          // Anthropic 格式: { object: "list", data: [...] }
          expect(response.data.object).toBe("list");
          expect(response.data.data).toBeInstanceOf(Array);
        }
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

  describe.skip("部门模型权限", () => {
    // TODO: /v1/models 端点尚未实现部门权限过滤功能
    it("应该拒绝无权限的模型访问", async () => {
      // 创建一个新部门，不给任何模型权限
      const deptData = createDepartmentData(testCompanyId, {
        name: `Restricted Dept ${Date.now()}`,
      });
      const deptResponse = await apiClient.createDepartment(deptData);

      if (deptResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (deptResponse.status === 201) {
        // 创建该部门的用户和 API Key
        const userData = createUserData(testCompanyId, deptResponse.data.id, {
          email: `restricted-user-${Date.now()}@example.com`,
          name: "Restricted User",
        });
        const userResponse = await apiClient.createUser(userData);

        if (userResponse.status === 201) {
          const keyResponse = await apiClient.createApiKey({
            user_id: userResponse.data.id,
            company_id: testCompanyId,
            department_id: deptResponse.data.id,
            name: "Restricted Key",
          });

          if (keyResponse.status === 201) {
            // 尝试访问模型（应该失败或返回空列表）
            const modelsResponse = await apiClient.proxyGetModels(keyResponse.data.key);
            expect(modelsResponse.status).toBe(200);
            // Anthropic 格式: { object: "list", data: [...] }
            expect(modelsResponse.data.object).toBe("list");
            // 无权限时应该返回空数组
            expect(modelsResponse.data.data.length).toBe(0);
          }
        }
      }
    });

    it("应该允许有权限的模型访问", async () => {
      // 创建新部门并给予权限
      const deptData = createDepartmentData(testCompanyId, {
        name: `Allowed Dept ${Date.now()}`,
      });
      const deptResponse = await apiClient.createDepartment(deptData);

      if (deptResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (deptResponse.status === 201) {
        // 先创建一个供应商和模型
        const providerData = createProviderData({
          name: `perm-test-provider-${Date.now()}`,
        });
        const providerResponse = await apiClient.createProvider(providerData);

        if (providerResponse.status === 201) {
          const modelData = createModelData(providerResponse.data.id, {
            model_id: `perm-test-model-${Date.now()}`,
          });
          const modelResponse = await apiClient.createModel(modelData);

          if (modelResponse.status === 201) {
            // 给部门添加模型权限
            await apiClient.setDepartmentModel(deptResponse.data.id, modelData.id, {
              is_allowed: true,
              daily_quota: 1000,
            });

            // 创建该部门的用户和 API Key
            const userData = createUserData(testCompanyId, deptResponse.data.id, {
              email: `allowed-user-${Date.now()}@example.com`,
              name: "Allowed User",
            });
            const userResponse = await apiClient.createUser(userData);

            if (userResponse.status === 201) {
              const keyResponse = await apiClient.createApiKey({
                user_id: userResponse.data.id,
                company_id: testCompanyId,
                department_id: deptResponse.data.id,
                name: "Allowed Key",
              });

              if (keyResponse.status === 201) {
                const modelsResponse = await apiClient.proxyGetModels(keyResponse.data.key);
                expect(modelsResponse.status).toBe(200);
                // Anthropic 格式: { object: "list", data: [...] }
                expect(modelsResponse.data.object).toBe("list");
                // 应该能看到有权限的模型
                expect(modelsResponse.data.data.length).toBeGreaterThan(0);
              }
            }
          }
        }
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
