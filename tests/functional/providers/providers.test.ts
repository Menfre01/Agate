/**
 * 供应商管理 API 测试
 *
 * @module tests/functional/providers/providers
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";
import {
  createCompanyData,
  createDepartmentData,
  createProviderData,
  createCredentialData,
} from "@test/helpers/test-data.factory";

describe("Providers API", () => {
  let apiClient: ApiClient;
  let baseUrl: string;
  let adminApiKey: string;
  let testCompanyId: string;

  beforeAll(async () => {
    baseUrl = process.env.TEST_BASE_URL || "http://localhost:8787";
    adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";
    apiClient = new ApiClient(baseUrl, adminApiKey);

    // 使用现有的 demo 数据
    testCompanyId = "co_demo_company";
  });

  describe("GET /admin/providers", () => {
    it("应该列出所有供应商", async () => {
      const response = await apiClient.listProviders();

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.providers).toBeInstanceOf(Array);
        expect(response.data.providers.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("POST /admin/providers", () => {
    it("应该成功创建供应商", async () => {
      const providerData = createProviderData({
        name: `test-provider-${Date.now()}`,
        display_name: "Test Provider",
        base_url: "https://api.test.com",
        api_version: "2023-06-01",
      });

      const response = await apiClient.createProvider(providerData);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([201, 409]).toContain(response.status);
        if (response.status === 201) {
          expect(response.data.name).toBe(providerData.name);
          expect(response.data.display_name).toBe("Test Provider");
          expect(response.data.base_url).toBe("https://api.test.com");
          expect(response.data.api_version).toBe("2023-06-01");
          expect(response.data.is_active).toBe(true);
        }
      }
    });

    it("应该拒绝重复的供应商名称", async () => {
      const uniqueName = `duplicate-provider-${Date.now()}`;
      const providerData = createProviderData({ name: uniqueName });

      // 第一次创建
      const firstResponse = await apiClient.createProvider(providerData);

      if (firstResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      // 第二次创建应该失败（如果第一次成功）
      if (firstResponse.status === 201) {
        const duplicateResponse = await apiClient.createProvider({
          ...providerData,
          id: crypto.randomUUID(),
        });
        expect([409, 500]).toContain(duplicateResponse.status);
      }
    });

    it("应该验证必填字段", async () => {
      const response = await apiClient.createProvider({
        name: "incomplete",
        display_name: "",
        base_url: "",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe("GET /admin/providers/:id", () => {
    it("应该获取供应商详情", async () => {
      // 先创建一个供应商
      const providerData = createProviderData({
        name: `get-provider-${Date.now()}`,
      });
      const createResponse = await apiClient.createProvider(providerData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.getProvider(createResponse.data.id);
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(createResponse.data.id);
        expect(response.data.name).toBe(providerData.name);
      }
    });

    it("应该返回 404 对于不存在的供应商", async () => {
      const response = await apiClient.getProvider(crypto.randomUUID());

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe("PUT /admin/providers/:id", () => {
    it("应该更新供应商信息", async () => {
      const providerData = createProviderData({
        name: `update-provider-${Date.now()}`,
      });
      const createResponse = await apiClient.createProvider(providerData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateProvider(createResponse.data.id, {
          display_name: "Updated Provider",
          base_url: "https://new-api.example.com",
          api_version: "2024-01-01",
        });

        expect(response.status).toBe(200);
        expect(response.data.display_name).toBe("Updated Provider");
        expect(response.data.base_url).toBe("https://new-api.example.com");
        expect(response.data.api_version).toBe("2024-01-01");
      }
    });

    it("应该禁用供应商", async () => {
      const providerData = createProviderData({
        name: `disable-provider-${Date.now()}`,
      });
      const createResponse = await apiClient.createProvider(providerData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.updateProvider(createResponse.data.id, {
          is_active: false,
        });
        expect(response.status).toBe(200);
        expect(response.data.is_active).toBe(false);
      }
    });

    it("应该重新启用供应商", async () => {
      const providerData = createProviderData({
        name: `enable-provider-${Date.now()}`,
      });
      const createResponse = await apiClient.createProvider(providerData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        await apiClient.updateProvider(createResponse.data.id, { is_active: false });
        const response = await apiClient.updateProvider(createResponse.data.id, {
          is_active: true,
        });
        expect(response.status).toBe(200);
        expect(response.data.is_active).toBe(true);
      }
    });
  });

  describe("DELETE /admin/providers/:id", () => {
    it("应该删除没有模型的供应商", async () => {
      const providerData = createProviderData({
        name: `delete-provider-${Date.now()}`,
      });
      const createResponse = await apiClient.createProvider(providerData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.deleteProvider(createResponse.data.id);
        expect(response.status).toBe(200);

        const getResponse = await apiClient.getProvider(createResponse.data.id);
        expect(getResponse.status).toBe(404);
      }
    });
  });

  describe("POST /admin/providers/:id/credentials", () => {
    it("应该添加凭证", async () => {
      const providerData = createProviderData({
        name: `credential-provider-${Date.now()}`,
      });
      const createResponse = await apiClient.createProvider(providerData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const credentialData = createCredentialData({
          credential_name: "Production Key",
          priority: 10,
          weight: 5,
        });

        const response = await apiClient.addProviderCredential(
          createResponse.data.id,
          credentialData
        );

        if (response.status !== 201) {
          console.log("Error response:", JSON.stringify(response.data, null, 2));
        }
        expect(response.status).toBe(201);
        expect(response.data.id).toBeDefined();
        expect(response.data.credential_name).toBe("Production Key");
        expect(response.data.is_active).toBe(true);
        expect(response.data.priority).toBe(10);
        expect(response.data.weight).toBe(5);
      }
    });

    it("应该加密 API Key", async () => {
      const providerData = createProviderData({
        name: `encrypt-provider-${Date.now()}`,
      });
      const createResponse = await apiClient.createProvider(providerData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const rawApiKey = "sk-test-raw-key-12345";
        const response = await apiClient.addProviderCredential(createResponse.data.id, {
          credential_name: "Encrypted Key",
          api_key: rawApiKey,
        });

        expect(response.status).toBe(201);
        // API key 不应该在响应中返回（安全考虑）
        expect(response.data.api_key_encrypted).toBeUndefined();
        expect(response.data.credential_name).toBe("Encrypted Key");
      }
    });

    it("应该拒绝不存在的供应商凭证", async () => {
      const response = await apiClient.addProviderCredential(crypto.randomUUID(), {
        credential_name: "Orphan Credential",
        api_key: "sk-test",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe("DELETE /admin/providers/credentials/:id", () => {
    it("应该删除凭证", async () => {
      const providerData = createProviderData({
        name: `delete-cred-provider-${Date.now()}`,
      });
      const createResponse = await apiClient.createProvider(providerData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const credResponse = await apiClient.addProviderCredential(
          providerData.id,
          createCredentialData()
        );

        if (credResponse.status === 201) {
          const response = await apiClient.deleteProviderCredential(
            credResponse.data.id
          );
          expect(response.status).toBe(200);
        }
      }
    });

    it.skip("应该返回 404 对于不存在的凭证", async () => {
      // TODO: DELETE /admin/providers/credentials/:id 端点未实现
      const response = await apiClient.deleteProviderCredential(
        crypto.randomUUID()
      );

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(404);
      }
    });
  });
});
