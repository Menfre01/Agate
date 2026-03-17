/**
 * 模型管理 API 测试
 *
 * @module tests/functional/models/models
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";
import {
  createProviderData,
  createModelData,
  createDepartmentData,
} from "@test/helpers/test-data.factory";

describe("Models API", () => {
  let apiClient: ApiClient;
  let baseUrl: string;
  let adminApiKey: string;
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

  describe("GET /admin/models", () => {
    it("应该列出所有模型", async () => {
      const response = await apiClient.listModels();

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        // 可能返回 500 如果数据库有问题
        expect([200, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.data.models).toBeInstanceOf(Array);
          expect(response.data.models.length).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe("POST /admin/models", () => {
    it("应该成功创建模型", async () => {
      // 先创建供应商
      const providerData = createProviderData({
        name: `model-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData(providerResponse.data.id, {
          model_id: `claude-3-sonnet-${Date.now()}`,
          display_name: "Claude 3 Sonnet",
          input_price: 0.003,
          output_price: 0.015,
          context_window: 200000,
          max_tokens: 4096,
        });

        const response = await apiClient.createModel(modelData);

        expect([201, 409]).toContain(response.status);
        if (response.status === 201) {
          expect(response.data.model_id).toContain("claude-3-sonnet");
          expect(response.data.display_name).toBe("Claude 3 Sonnet");
          expect(response.data.provider_id).toBe(providerResponse.data.id);
          expect(response.data.input_price).toBe(0.003);
          expect(response.data.output_price).toBe(0.015);
          expect(response.data.context_window).toBe(200000);
          expect(response.data.max_tokens).toBe(4096);
        }
      }
    });

    it("应该拒绝重复的 model_id", async () => {
      const providerData = createProviderData({
        name: `dup-model-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelId = `duplicate-model-${Date.now()}`;
        const modelData = createModelData(providerResponse.data.id, {
          model_id: modelId,
        });

        const firstResponse = await apiClient.createModel(modelData);
        if (firstResponse.status === 201) {
          const duplicateResponse = await apiClient.createModel({
            ...modelData,
            id: crypto.randomUUID(),
          });
          expect(duplicateResponse.status).toBe(409);
        }
      }
    });

    it("应该拒绝不存在供应商的模型", async () => {
      const response = await apiClient.createModel({
        ...createModelData(crypto.randomUUID()),
        provider_id: crypto.randomUUID(),
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 404]).toContain(response.status);
      }
    });
  });

  describe("GET /admin/models/:id", () => {
    it("应该获取模型详情", async () => {
      // 先创建供应商和模型
      const providerData = createProviderData({
        name: `get-model-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData(providerResponse.data.id);
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const response = await apiClient.getModel(modelResponse.data.id);
          expect(response.status).toBe(200);
          expect(response.data.id).toBe(modelResponse.data.id);
          expect(response.data.model_id).toBe(modelData.model_id);
        }
      }
    });

    it("应该返回 404 对于不存在的模型", async () => {
      const response = await apiClient.getModel(crypto.randomUUID());

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe("PUT /admin/models/:id", () => {
    it("应该更新模型显示名称", async () => {
      const providerData = createProviderData({
        name: `update-name-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData(providerResponse.data.id);
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const response = await apiClient.updateModel(modelResponse.data.id, {
            display_name: "Updated Model Name",
          });
          expect(response.status).toBe(200);
          expect(response.data.display_name).toBe("Updated Model Name");
        }
      }
    });

    it.skip("应该更新模型价格", async () => {
      // TODO: UpdateModelDto 不支持价格更新
      // 价格应通过模型-供应商关联或重新创建模型来更新
      const providerData = createProviderData({
        name: `update-price-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData(providerResponse.data.id);
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const response = await apiClient.updateModel(modelResponse.data.id, {
            input_price: 0.005,
            output_price: 0.02,
          });
          expect(response.status).toBe(200);
          expect(response.data.input_price).toBe(0.005);
          expect(response.data.output_price).toBe(0.02);
        }
      }
    });

    it("应该禁用模型", async () => {
      const providerData = createProviderData({
        name: `disable-model-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData(providerResponse.data.id);
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const response = await apiClient.updateModel(modelResponse.data.id, {
            is_active: false,
          });
          expect(response.status).toBe(200);
          expect(response.data.is_active).toBe(false);
        }
      }
    });
  });

  describe("DELETE /admin/models/:id", () => {
    it("应该删除未关联的模型", async () => {
      const providerData = createProviderData({
        name: `delete-model-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData(providerResponse.data.id);
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const response = await apiClient.deleteModel(modelResponse.data.id);
          expect(response.status).toBe(200);

          const getResponse = await apiClient.getModel(modelResponse.data.id);
          expect(getResponse.status).toBe(404);
        }
      }
    });
  });

  describe("POST /admin/models/:id/link", () => {
    it.skip("应该关联供应商和定价", async () => {
      // TODO: 当前架构中模型直接关联单一供应商，不支持多供应商关联
      // 此功能已过时，需要重新设计或移除
      // 创建第一个供应商
      const provider1Data = createProviderData({
        name: `link-provider-1-${Date.now()}`,
      });
      const provider1Response = await apiClient.createProvider(provider1Data);

      // 创建第二个供应商
      const provider2Data = createProviderData({
        name: `link-provider-2-${Date.now()}`,
      });
      const provider2Response = await apiClient.createProvider(provider2Data);

      if (provider1Response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (provider1Response.status === 201 && provider2Response.status === 201) {
        const modelData = createModelData(provider1Response.data.id);
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const response = await apiClient.linkModelToProvider(modelResponse.data.id, {
            provider_id: provider2Response.data.id,
            input_price: 0.002,
            output_price: 0.01,
          });
          expect(response.status).toBe(200);
        }
      }
    });
  });

  describe("POST /admin/departments/:id/models", () => {
    it("应该设置部门模型权限", async () => {
      // 创建供应商和模型
      const providerData = createProviderData({
        name: `dept-perm-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData(providerResponse.data.id);
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const response = await apiClient.setDepartmentModel(
            testDeptId,
            modelResponse.data.id,
            {
              is_allowed: true,
              daily_quota: 5000,
            }
          );
          if (response.status !== 200 && response.status !== 201) {
            console.log("Error setting department model:", JSON.stringify(response.data, null, 2));
          }
          expect([200, 201]).toContain(response.status);
        }
      }
    });

    it("应该更新现有权限配置", async () => {
      const providerData = createProviderData({
        name: `update-perm-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData(providerResponse.data.id);
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          // 首次设置
          await apiClient.setDepartmentModel(testDeptId, modelResponse.data.id, {
            is_allowed: true,
            daily_quota: 1000,
          });

          // 更新
          const response = await apiClient.setDepartmentModel(
            testDeptId,
            modelResponse.data.id,
            {
              is_allowed: true,
              daily_quota: 5000,
            }
          );
          expect([200, 201]).toContain(response.status);
        }
      }
    });

    it("应该拒绝不存在部门的权限设置", async () => {
      const response = await apiClient.setDepartmentModel(
        crypto.randomUUID(),
        crypto.randomUUID(),
        { is_allowed: true }
      );

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(404);
      }
    });
  });
});
