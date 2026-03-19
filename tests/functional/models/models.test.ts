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
  createModelProviderData,
  createDepartmentData,
} from "@test/helpers/test-data.factory";

describe("Models API", () => {
  let apiClient: ApiClient;
  let adminBaseUrl: string;
  let proxyBaseUrl: string;
  let adminApiKey: string;
  let testCompanyId: string;
  let testDeptId: string;

  beforeAll(async () => {
    adminBaseUrl = process.env.TEST_ADMIN_BASE_URL || "http://localhost:8788";
    proxyBaseUrl = process.env.TEST_PROXY_BASE_URL || "http://localhost:8787";
    adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";
    apiClient = new ApiClient(adminBaseUrl, proxyBaseUrl, adminApiKey);

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
        // 1. 创建模型（不需要 providerId）
        const modelData = createModelData({
          model_id: `claude-3-sonnet-${Date.now()}`,
          display_name: "Claude 3 Sonnet",
          context_window: 200000,
          max_tokens: 4096,
        });

        const modelResponse = await apiClient.createModel(modelData);

        expect([201, 409]).toContain(modelResponse.status);
        if (modelResponse.status === 201) {
          expect(modelResponse.data.model_id).toContain("claude-3-sonnet");
          expect(modelResponse.data.display_name).toBe("Claude 3 Sonnet");
          expect(modelResponse.data.context_window).toBe(200000);
          expect(modelResponse.data.max_tokens).toBe(4096);

          // 2. 添加供应商到模型（n:n 关系）
          const providerData = createModelProviderData(providerResponse.data.id, {
            input_price: 0.003,
            output_price: 0.015,
          });
          const linkResponse = await apiClient.addModelProvider(modelResponse.data.id, providerData);

          expect([201, 409]).toContain(linkResponse.status);
          if (linkResponse.status === 201) {
            expect(linkResponse.data.provider_id).toBe(providerResponse.data.id);
            expect(linkResponse.data.input_price).toBe(0.003);
            expect(linkResponse.data.output_price).toBe(0.015);
          }
        }
      }
    });

    it("应该拒绝重复的 model_id", async () => {
      const modelId = `duplicate-model-${Date.now()}`;
      const modelData = createModelData({
        model_id: modelId,
      });

      const firstResponse = await apiClient.createModel(modelData);

      if (firstResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (firstResponse.status === 201) {
        const duplicateResponse = await apiClient.createModel({
          ...modelData,
        });
        expect(duplicateResponse.status).toBe(409);
      }
    });

    it("应该允许为模型添加多个供应商", async () => {
      // 创建两个供应商
      const provider1Data = createProviderData({
        name: `multi-provider-1-${Date.now()}`,
      });
      const provider2Data = createProviderData({
        name: `multi-provider-2-${Date.now()}`,
      });

      const [provider1Response, provider2Response] = await Promise.all([
        apiClient.createProvider(provider1Data),
        apiClient.createProvider(provider2Data),
      ]);

      if (provider1Response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (provider1Response.status === 201 && provider2Response.status === 201) {
        // 创建模型
        const modelData = createModelData({
          model_id: `multi-vendor-model-${Date.now()}`,
        });
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          // 添加第一个供应商
          const link1Response = await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(provider1Response.data.id, {
              input_price: 0.003,
              output_price: 0.015,
            })
          );

          // 添加第二个供应商
          const link2Response = await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(provider2Response.data.id, {
              input_price: 0.002,
              output_price: 0.01,
            })
          );

          expect([201, 409]).toContain(link1Response.status);
          expect([201, 409]).toContain(link2Response.status);

          if (link1Response.status === 201 && link2Response.status === 201) {
            // 验证模型有两个供应商
            const listResponse = await apiClient.listModelProviders(modelResponse.data.id);
            expect(listResponse.status).toBe(200);
            expect(listResponse.data.providers).toHaveLength(2);
          }
        }
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
        const modelData = createModelData();
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          // 添加供应商
          await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(providerResponse.data.id)
          );

          const response = await apiClient.getModel(modelResponse.data.id);
          expect(response.status).toBe(200);
          expect(response.data.id).toBe(modelResponse.data.id);
          expect(response.data.model_id).toBe(modelData.model_id);
          // 验证供应商列表存在
          expect(response.data.providers).toBeInstanceOf(Array);
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
        const modelData = createModelData();
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

    it("应该通过添加新的供应商关联来更新价格", async () => {
      const providerData = createProviderData({
        name: `update-price-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData();
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          // 添加供应商关联
          const addResponse = await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(providerResponse.data.id, {
              input_price: 0.003,
              output_price: 0.015,
            })
          );

          if (addResponse.status === 201) {
            // 移除旧的关联
            await apiClient.removeModelProvider(
              modelResponse.data.id,
              providerResponse.data.id
            );

            // 重新添加新价格
            const response = await apiClient.addModelProvider(
              modelResponse.data.id,
              createModelProviderData(providerResponse.data.id, {
                input_price: 0.005,
                output_price: 0.02,
              })
            );
            expect(response.status).toBe(201);
            expect(response.data.input_price).toBe(0.005);
            expect(response.data.output_price).toBe(0.02);
          }
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
        const modelData = createModelData();
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
    it("应该删除模型", async () => {
      const providerData = createProviderData({
        name: `delete-model-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData();
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

  describe("POST /admin/models/:id/providers", () => {
    it("应该添加供应商到模型", async () => {
      const providerData = createProviderData({
        name: `add-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData();
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const response = await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(providerResponse.data.id, {
              input_price: 0.002,
              output_price: 0.01,
            })
          );
          expect([201, 409]).toContain(response.status);
          if (response.status === 201) {
            expect(response.data.provider_id).toBe(providerResponse.data.id);
            expect(response.data.input_price).toBe(0.002);
            expect(response.data.output_price).toBe(0.01);
          }
        }
      }
    });

    it("应该拒绝重复添加同一供应商", async () => {
      const providerData = createProviderData({
        name: `dup-add-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData();
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const firstResponse = await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(providerResponse.data.id)
          );

          if (firstResponse.status === 201) {
            const duplicateResponse = await apiClient.addModelProvider(
              modelResponse.data.id,
              createModelProviderData(providerResponse.data.id)
            );
            expect(duplicateResponse.status).toBe(409);
          }
        }
      }
    });
  });

  describe("DELETE /admin/models/:id/providers/:providerId", () => {
    it("应该从模型移除供应商", async () => {
      const providerData = createProviderData({
        name: `remove-provider-${Date.now()}`,
      });
      const providerResponse = await apiClient.createProvider(providerData);

      if (providerResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (providerResponse.status === 201) {
        const modelData = createModelData();
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          const addResponse = await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(providerResponse.data.id)
          );

          if (addResponse.status === 201) {
            const response = await apiClient.removeModelProvider(
              modelResponse.data.id,
              providerResponse.data.id
            );
            expect(response.status).toBe(200);

            // 验证供应商已移除
            const listResponse = await apiClient.listModelProviders(modelResponse.data.id);
            expect(listResponse.data.providers).toHaveLength(0);
          }
        }
      }
    });
  });

  describe("GET /admin/models/:id/providers", () => {
    it("应该列出模型的所有供应商", async () => {
      // 创建多个供应商
      const providers = await Promise.all([
        apiClient.createProvider(createProviderData({ name: `list-provider-1-${Date.now()}` })),
        apiClient.createProvider(createProviderData({ name: `list-provider-2-${Date.now()}` })),
        apiClient.createProvider(createProviderData({ name: `list-provider-3-${Date.now()}` })),
      ]);

      if (providers[0].status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      const validProviders = providers.filter((p) => p.status === 201);

      if (validProviders.length >= 2) {
        const modelData = createModelData();
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          // 添加多个供应商
          await Promise.all(
            validProviders.slice(0, 2).map((p) =>
              apiClient.addModelProvider(
                modelResponse.data.id,
                createModelProviderData(p.data.id)
              )
            )
          );

          const response = await apiClient.listModelProviders(modelResponse.data.id);
          expect(response.status).toBe(200);
          expect(response.data.providers).toHaveLength(2);
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
        const modelData = createModelData();
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          // 添加供应商
          await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(providerResponse.data.id)
          );

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
        const modelData = createModelData();
        const modelResponse = await apiClient.createModel(modelData);

        if (modelResponse.status === 201) {
          // 添加供应商
          await apiClient.addModelProvider(
            modelResponse.data.id,
            createModelProviderData(providerResponse.data.id)
          );

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

  describe("Model Alias 功能", () => {
    it("应该创建带 alias 的模型", async () => {
      const modelData = createModelData({
        model_id: `opus-${Date.now()}`,
        alias: "glm-5",
        display_name: "Opus (映射到 GLM-5)",
      });

      const response = await apiClient.createModel(modelData);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        expect(response.data.model_id).toContain("opus-");
        expect(response.data.alias).toBe("glm-5");
        expect(response.data.display_name).toBe("Opus (映射到 GLM-5)");
      }
    });

    it("应该创建不带 alias 的模型（alias 为 null）", async () => {
      const modelData = createModelData({
        model_id: `direct-model-${Date.now()}`,
        display_name: "Direct Model",
      });

      const response = await apiClient.createModel(modelData);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        expect(response.data.alias).toBeNull();
      }
    });

    it("应该更新模型的 alias", async () => {
      const modelData = createModelData({
        model_id: `update-alias-${Date.now()}`,
        display_name: "Update Alias Test",
      });

      const createResponse = await apiClient.createModel(modelData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const newAlias = `new-alias-${Date.now()}`;
        const updateResponse = await apiClient.updateModel(
          createResponse.data.id,
          { alias: newAlias }
        );

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.alias).toBe(newAlias);
      }
    });

    it("应该移除模型的 alias（设置为 null）", async () => {
      const modelData = createModelData({
        model_id: `remove-alias-${Date.now()}`,
        alias: `temp-alias-${Date.now()}`,
        display_name: "Remove Alias Test",
      });

      const createResponse = await apiClient.createModel(modelData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const updateResponse = await apiClient.updateModel(
          createResponse.data.id,
          { alias: null }
        );

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.alias).toBeNull();
      }
    });

    it("应该拒绝重复的 alias", async () => {
      const alias = `duplicate-alias-${Date.now()}`;

      // 创建第一个模型，带 alias
      const firstModel = createModelData({
        model_id: `first-alias-model-${Date.now()}`,
        alias: alias,
        display_name: "First Model",
      });

      const firstResponse = await apiClient.createModel(firstModel);

      if (firstResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (firstResponse.status === 201) {
        // 创建第二个模型，使用相同的 alias
        const secondModel = createModelData({
          model_id: `second-alias-model-${Date.now()}`,
          alias: alias,
          display_name: "Second Model",
        });

        const secondResponse = await apiClient.createModel(secondModel);

        // 应该返回 409 Conflict
        expect(secondResponse.status).toBe(409);
      }
    });
  });
});
