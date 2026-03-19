/**
 * Unit tests for ModelService.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ModelService } from "@/services/model.service.js";
import type { Model, Env } from "@/types/index.ts";
import { NotFoundError, ValidationError, ConflictError } from "@/utils/errors/index.js";

// Mock queries module
vi.mock("@/db/queries.js", () => ({
  getModel: vi.fn(),
  getModelByModelId: vi.fn(),
  getModelByAlias: vi.fn(),
  listModels: vi.fn(),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  deleteModel: vi.fn(),
  getDepartmentModel: vi.fn(),
  createDepartmentModel: vi.fn(),
  updateDepartmentModel: vi.fn(),
  listDepartmentModels: vi.fn(),
  getDepartment: vi.fn(),
  getProvider: vi.fn(),
  getProvidersForModel: vi.fn(),
  getModelProvider: vi.fn(),
  addModelProvider: vi.fn(),
  removeModelProvider: vi.fn(),
}));

import * as queries from "@/db/queries.js";

describe("ModelService", () => {
  let modelService: ModelService;
  let mockEnv: Env;

  const mockModel: Model = {
    id: "model-123",
    model_id: "claude-3-sonnet",
    alias: null,
    display_name: "Claude 3 Sonnet",
    context_window: 200000,
    max_tokens: 4096,
    is_active: true,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const mockModelProvider = {
    id: "mp-123",
    model_id: "model-123",
    provider_id: "provider-123",
    input_price: 3.0,
    output_price: 15.0,
    is_active: true,
    created_at: Date.now(),
    updated_at: Date.now(),
    provider_name: "anthropic",
    provider_display_name: "Anthropic",
  };

  beforeEach(() => {
    mockEnv = {
      DB: {} as unknown as D1Database,
      CACHE: {} as KVNamespace,
      ENCRYPTION_KEY: "test-key",
    };

    // Setup mock returns
    vi.mocked(queries.getModel).mockResolvedValue(mockModel);
    vi.mocked(queries.getModelByModelId).mockResolvedValue(mockModel);
    vi.mocked(queries.getModelByAlias).mockResolvedValue(null);
    vi.mocked(queries.listModels).mockResolvedValue([mockModel]);
    vi.mocked(queries.createModel).mockResolvedValue(mockModel);
    vi.mocked(queries.updateModel).mockResolvedValue(mockModel);
    vi.mocked(queries.deleteModel).mockResolvedValue(undefined);
    vi.mocked(queries.getDepartmentModel).mockResolvedValue(null);
    vi.mocked(queries.createDepartmentModel).mockResolvedValue(undefined);
    vi.mocked(queries.updateDepartmentModel).mockResolvedValue(undefined);
    vi.mocked(queries.listDepartmentModels).mockResolvedValue([]);
    vi.mocked(queries.getDepartment).mockResolvedValue({ name: "Test Dept" });
    vi.mocked(queries.getProvider).mockResolvedValue({
      id: "provider-123",
      name: "anthropic",
      display_name: "Anthropic",
      base_url: "https://api.anthropic.com",
      api_version: "2023-06-01",
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    vi.mocked(queries.getProvidersForModel).mockResolvedValue([mockModelProvider]);
    vi.mocked(queries.getModelProvider).mockResolvedValue(mockModelProvider);
    vi.mocked(queries.removeModelProvider).mockResolvedValue(true);

    modelService = new ModelService(mockEnv);
  });

  describe("listModels", () => {
    it("should list all models", async () => {
      const models = await modelService.listModels();
      expect(models).toHaveLength(1);
      expect(models[0].model_id).toBe("claude-3-sonnet");
    });
  });

  describe("getModel", () => {
    it("should get model by ID", async () => {
      const model = await modelService.getModel("model-123");
      expect(model).toBeDefined();
      expect(model.model_id).toBe("claude-3-sonnet");
    });

    it("should throw NotFoundError for non-existent model", async () => {
      vi.mocked(queries.getModel).mockResolvedValue(null);

      await expect(modelService.getModel("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("getByModelId", () => {
    it("should get model by model_id", async () => {
      const model = await modelService.getByModelId("claude-3-sonnet");
      expect(model).toBeDefined();
      expect(model?.model_id).toBe("claude-3-sonnet");
    });

    it("should return null for non-existent model_id", async () => {
      vi.mocked(queries.getModelByModelId).mockResolvedValue(null);

      const model = await modelService.getByModelId("non-existent");
      expect(model).toBeNull();
    });
  });

  describe("createModel", () => {
    it("should create model with valid data", async () => {
      const newModel = { ...mockModel, id: "model-456", model_id: "claude-3-opus" };
      vi.mocked(queries.getModelByModelId).mockResolvedValue(null);
      vi.mocked(queries.createModel).mockResolvedValue(newModel);

      const result = await modelService.createModel({
        model_id: "claude-3-opus",
        display_name: "Claude 3 Opus",
        context_window: 200000,
      });
      expect(result.model_id).toBe("claude-3-opus");
    });

    it("should reject duplicate model_id", async () => {
      vi.mocked(queries.getModelByModelId).mockResolvedValue(mockModel);

      await expect(
        modelService.createModel({
          model_id: "claude-3-sonnet",
          display_name: "Duplicate",
        })
      ).rejects.toThrow(ConflictError);
      await expect(
        modelService.createModel({
          model_id: "claude-3-sonnet",
          display_name: "Duplicate",
        })
      ).rejects.toThrow("Model with this model_id already exists");
    });

    it("should use default values for optional fields", async () => {
      const newModel = { ...mockModel, id: "model-456", model_id: "new-model" };
      vi.mocked(queries.getModelByModelId).mockResolvedValue(null);
      vi.mocked(queries.createModel).mockResolvedValue(newModel);

      const result = await modelService.createModel({
        model_id: "new-model",
        display_name: "New Model",
      });

      expect(queries.createModel).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          context_window: 0,
          max_tokens: 0,
        })
      );
    });

    it("should create model with alias", async () => {
      const newModel = { ...mockModel, id: "model-456", model_id: "opus", alias: "glm-5" };
      vi.mocked(queries.getModelByModelId).mockResolvedValue(null);
      vi.mocked(queries.createModel).mockResolvedValue(newModel);

      const result = await modelService.createModel({
        model_id: "opus",
        alias: "glm-5",
        display_name: "Opus (mapped to GLM-5)",
      });

      expect(queries.createModel).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          alias: "glm-5",
        })
      );
      expect(result.alias).toBe("glm-5");
    });

    it("should create model with null alias when not provided", async () => {
      const newModel = { ...mockModel, id: "model-456", model_id: "new-model", alias: null };
      vi.mocked(queries.getModelByModelId).mockResolvedValue(null);
      vi.mocked(queries.createModel).mockResolvedValue(newModel);

      const result = await modelService.createModel({
        model_id: "new-model",
        display_name: "New Model",
      });

      expect(queries.createModel).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          alias: null,
        })
      );
      expect(result.alias).toBeNull();
    });
  });

  describe("isModelAllowed", () => {
    it("should return true when no department", async () => {
      const allowed = await modelService.isModelAllowed(null, "model-123");
      expect(allowed).toBe(true);
    });

    it("should return true when no config exists", async () => {
      const allowed = await modelService.isModelAllowed("dept-123", "model-123");
      expect(allowed).toBe(true);
    });

    it("should return true when config allows model", async () => {
      const mockConfig = {
        id: "config-123",
        department_id: "dept-123",
        model_id: "model-123",
        is_allowed: true,
        daily_quota: 10000,
        created_at: Date.now(),
      };
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(mockConfig);

      const allowed = await modelService.isModelAllowed("dept-123", "model-123");
      expect(allowed).toBe(true);
    });

    it("should return false when config disallows model", async () => {
      const mockConfig = {
        id: "config-123",
        department_id: "dept-123",
        model_id: "model-123",
        is_allowed: false,
        daily_quota: 0,
        created_at: Date.now(),
      };
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(mockConfig);

      const allowed = await modelService.isModelAllowed("dept-123", "model-123");
      expect(allowed).toBe(false);
    });
  });

  describe("setDepartmentModel", () => {
    it("should set department model access", async () => {
      vi.mocked(queries.getDepartment).mockResolvedValue({
        id: "dept-123",
        company_id: "company-123",
        name: "Test Dept",
        quota_pool: 100000,
        quota_used: 0,
        quota_daily: 50000,
        daily_used: 0,
        last_reset_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const result = await modelService.setDepartmentModel(
        "dept-123",
        "model-123",
        { is_allowed: true, daily_quota: 10000 }
      );

      expect(result.is_allowed).toBe(true);
      expect(result.daily_quota).toBe(10000);
    });

    it("should throw NotFoundError when department does not exist", async () => {
      vi.mocked(queries.getDepartment).mockResolvedValue(null);

      await expect(
        modelService.setDepartmentModel("non-existent", "model-123", {
          is_allowed: true,
          daily_quota: 10000,
        })
      ).rejects.toThrow(NotFoundError);
      await expect(
        modelService.setDepartmentModel("non-existent", "model-123", {
          is_allowed: true,
          daily_quota: 10000,
        })
      ).rejects.toThrow("Department not found");
    });

    it("should throw NotFoundError when model does not exist", async () => {
      vi.mocked(queries.getModel).mockResolvedValue(null);

      await expect(
        modelService.setDepartmentModel("dept-123", "non-existent", {
          is_allowed: true,
          daily_quota: 10000,
        })
      ).rejects.toThrow(NotFoundError);
      await expect(
        modelService.setDepartmentModel("dept-123", "non-existent", {
          is_allowed: true,
          daily_quota: 10000,
        })
      ).rejects.toThrow("Model not found");
    });

    it("should update existing department model config", async () => {
      const existingConfig = {
        id: "config-123",
        department_id: "dept-123",
        model_id: "model-123",
        is_allowed: false,
        daily_quota: 0,
        created_at: Date.now() - 100000,
      };
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(existingConfig);
      vi.mocked(queries.getDepartment).mockResolvedValue({
        id: "dept-123",
        company_id: "company-123",
        name: "Test Dept",
        quota_pool: 100000,
        quota_used: 0,
        quota_daily: 50000,
        daily_used: 0,
        last_reset_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const result = await modelService.setDepartmentModel(
        "dept-123",
        "model-123",
        { is_allowed: true, daily_quota: 5000 }
      );

      expect(queries.updateDepartmentModel).toHaveBeenCalledWith(
        expect.anything(),
        "config-123",
        { is_allowed: true, daily_quota: 5000 }
      );
      expect(result.created_at).toBe(existingConfig.created_at);
    });

    it("should create new department model config", async () => {
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(null);
      vi.mocked(queries.getDepartment).mockResolvedValue({
        id: "dept-123",
        company_id: "company-123",
        name: "Test Dept",
        quota_pool: 100000,
        quota_used: 0,
        quota_daily: 50000,
        daily_used: 0,
        last_reset_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const result = await modelService.setDepartmentModel(
        "dept-123",
        "model-123",
        { is_allowed: false, daily_quota: 0 }
      );

      expect(queries.createDepartmentModel).toHaveBeenCalled();
    });

    it("should use default daily_quota when not provided", async () => {
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(null);
      vi.mocked(queries.getDepartment).mockResolvedValue({
        id: "dept-123",
        company_id: "company-123",
        name: "Test Dept",
        quota_pool: 100000,
        quota_used: 0,
        quota_daily: 50000,
        daily_used: 0,
        last_reset_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      await modelService.setDepartmentModel("dept-123", "model-123", {
        is_allowed: true,
      });

      expect(queries.createDepartmentModel).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ daily_quota: 0 })
      );
    });
  });

  describe("updateModel", () => {
    it("should update model", async () => {
      const updatedModel = { ...mockModel, display_name: "Updated Name" };
      vi.mocked(queries.updateModel).mockResolvedValue(updatedModel);

      const result = await modelService.updateModel("model-123", {
        display_name: "Updated Name",
      });
      expect(result.display_name).toBe("Updated Name");
    });

    it("should throw NotFoundError for non-existent model", async () => {
      vi.mocked(queries.getModel).mockResolvedValue(null);

      await expect(
        modelService.updateModel("non-existent", { display_name: "Test" })
      ).rejects.toThrow(NotFoundError);
    });

    it("should update multiple fields", async () => {
      const updatedModel = {
        ...mockModel,
        display_name: "Updated",
        context_window: 300000,
        max_tokens: 8192,
      };
      vi.mocked(queries.updateModel).mockResolvedValue(updatedModel);

      const result = await modelService.updateModel("model-123", {
        display_name: "Updated",
        context_window: 300000,
        max_tokens: 8192,
      });

      expect(queries.updateModel).toHaveBeenCalledWith(
        expect.anything(),
        "model-123",
        {
          display_name: "Updated",
          context_window: 300000,
          max_tokens: 8192,
          is_active: undefined,
        }
      );
    });

    it("should update model alias", async () => {
      const updatedModel = { ...mockModel, alias: "glm-5" };
      vi.mocked(queries.updateModel).mockResolvedValue(updatedModel);

      const result = await modelService.updateModel("model-123", {
        alias: "glm-5",
      });

      expect(queries.updateModel).toHaveBeenCalledWith(
        expect.anything(),
        "model-123",
        expect.objectContaining({
          alias: "glm-5",
        })
      );
      expect(result.alias).toBe("glm-5");
    });

    it("should remove model alias by setting to null", async () => {
      const modelWithAlias = { ...mockModel, alias: "old-alias" };
      const updatedModel = { ...mockModel, alias: null };
      vi.mocked(queries.getModel).mockResolvedValue(modelWithAlias);
      vi.mocked(queries.updateModel).mockResolvedValue(updatedModel);

      const result = await modelService.updateModel("model-123", {
        alias: null,
      });

      expect(queries.updateModel).toHaveBeenCalledWith(
        expect.anything(),
        "model-123",
        expect.objectContaining({
          alias: null,
        })
      );
      expect(result.alias).toBeNull();
    });
  });

  describe("deleteModel", () => {
    it("should delete model", async () => {
      await expect(modelService.deleteModel("model-123")).resolves.not.toThrow();
      expect(queries.deleteModel).toHaveBeenCalledWith(expect.anything(), "model-123");
    });

    it("should throw NotFoundError for non-existent model", async () => {
      vi.mocked(queries.getModel).mockResolvedValue(null);

      await expect(modelService.deleteModel("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("getDepartmentModel", () => {
    it("should return null when config does not exist", async () => {
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(null);

      const result = await modelService.getDepartmentModel("dept-123", "model-123");
      expect(result).toBeNull();
    });

    it("should return null when department not found", async () => {
      const mockConfig = {
        id: "config-123",
        department_id: "dept-123",
        model_id: "model-123",
        is_allowed: true,
        daily_quota: 10000,
        created_at: Date.now(),
      };
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(mockConfig);
      vi.mocked(queries.getDepartment).mockResolvedValue(null);
      vi.mocked(queries.getModel).mockResolvedValue(mockModel);

      const result = await modelService.getDepartmentModel("dept-123", "model-123");
      expect(result).toBeNull();
    });

    it("should return null when model not found", async () => {
      const mockConfig = {
        id: "config-123",
        department_id: "dept-123",
        model_id: "model-123",
        is_allowed: true,
        daily_quota: 10000,
        created_at: Date.now(),
      };
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(mockConfig);
      vi.mocked(queries.getDepartment).mockResolvedValue({
        id: "dept-123",
        company_id: "company-123",
        name: "Test Dept",
        quota_pool: 100000,
        quota_used: 0,
        quota_daily: 50000,
        daily_used: 0,
        last_reset_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      vi.mocked(queries.getModel).mockResolvedValue(null);

      const result = await modelService.getDepartmentModel("dept-123", "model-123");
      expect(result).toBeNull();
    });

    it("should return department model config when all exist", async () => {
      const mockConfig = {
        id: "config-123",
        department_id: "dept-123",
        model_id: "model-123",
        is_allowed: true,
        daily_quota: 10000,
        created_at: Date.now(),
      };
      vi.mocked(queries.getDepartmentModel).mockResolvedValue(mockConfig);
      vi.mocked(queries.getDepartment).mockResolvedValue({
        id: "dept-123",
        company_id: "company-123",
        name: "Test Dept",
        quota_pool: 100000,
        quota_used: 0,
        quota_daily: 50000,
        daily_used: 0,
        last_reset_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      vi.mocked(queries.getModel).mockResolvedValue(mockModel);

      const result = await modelService.getDepartmentModel("dept-123", "model-123");

      expect(result).toEqual({
        department_id: "dept-123",
        department_name: "Test Dept",
        model_id: "model-123",
        model_display_name: "Claude 3 Sonnet",
        is_allowed: true,
        daily_quota: 10000,
        created_at: mockConfig.created_at,
      });
    });
  });

  describe("listDepartmentModels", () => {
    it("should return empty array when no configs", async () => {
      vi.mocked(queries.listDepartmentModels).mockResolvedValue([]);

      const result = await modelService.listDepartmentModels("dept-123");
      expect(result).toEqual([]);
    });

    it("should list department models", async () => {
      const mockConfigs = [
        {
          id: "config-1",
          department_id: "dept-123",
          model_id: "model-1",
          is_allowed: true,
          daily_quota: 10000,
          created_at: Date.now(),
        },
        {
          id: "config-2",
          department_id: "dept-123",
          model_id: "model-2",
          is_allowed: false,
          daily_quota: 0,
          created_at: Date.now(),
        },
      ];
      vi.mocked(queries.listDepartmentModels).mockResolvedValue(mockConfigs);
      vi.mocked(queries.getDepartment).mockResolvedValue({
        id: "dept-123",
        company_id: "company-123",
        name: "Test Dept",
        quota_pool: 100000,
        quota_used: 0,
        quota_daily: 50000,
        daily_used: 0,
        last_reset_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      vi.mocked(queries.getModel).mockResolvedValue(mockModel);

      const result = await modelService.listDepartmentModels("dept-123");

      expect(result).toHaveLength(2);
      expect(result[0].department_id).toBe("dept-123");
      expect(result[0].department_name).toBe("Test Dept");
    });

    it("should handle missing department", async () => {
      const mockConfigs = [
        {
          id: "config-1",
          department_id: "dept-123",
          model_id: "model-1",
          is_allowed: true,
          daily_quota: 10000,
          created_at: Date.now(),
        },
      ];
      vi.mocked(queries.listDepartmentModels).mockResolvedValue(mockConfigs);
      vi.mocked(queries.getDepartment).mockResolvedValue(null);
      vi.mocked(queries.getModel).mockResolvedValue(mockModel);

      const result = await modelService.listDepartmentModels("dept-123");

      expect(result).toHaveLength(1);
      expect(result[0].department_name).toBe("");
    });

    it("should handle missing model", async () => {
      const mockConfigs = [
        {
          id: "config-1",
          department_id: "dept-123",
          model_id: "model-1",
          is_allowed: true,
          daily_quota: 10000,
          created_at: Date.now(),
        },
      ];
      vi.mocked(queries.listDepartmentModels).mockResolvedValue(mockConfigs);
      vi.mocked(queries.getDepartment).mockResolvedValue({
        id: "dept-123",
        company_id: "company-123",
        name: "Test Dept",
        quota_pool: 100000,
        quota_used: 0,
        quota_daily: 50000,
        daily_used: 0,
        last_reset_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      vi.mocked(queries.getModel).mockResolvedValue(null);

      const result = await modelService.listDepartmentModels("dept-123");

      expect(result).toHaveLength(1);
      expect(result[0].model_display_name).toBe("");
    });
  });

  describe("addProvider", () => {
    it("should add provider to model", async () => {
      vi.mocked(queries.getModelProvider).mockResolvedValue(null);
      vi.mocked(queries.addModelProvider).mockResolvedValue({
        id: "mp-123",
        model_id: "model-123",
        provider_id: "provider-456",
        input_price: 2.5,
        output_price: 12.0,
        is_active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const result = await modelService.addProvider("model-123", {
        provider_id: "provider-456",
        input_price: 2.5,
        output_price: 12.0,
      });

      expect(result.provider_id).toBe("provider-456");
      expect(result.input_price).toBe(2.5);
    });

    it("should throw NotFoundError when model not found", async () => {
      vi.mocked(queries.getModel).mockResolvedValue(null);

      await expect(
        modelService.addProvider("non-existent", {
          provider_id: "provider-123",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError when provider not found", async () => {
      vi.mocked(queries.getProvider).mockResolvedValue(null);

      await expect(
        modelService.addProvider("model-123", {
          provider_id: "non-existent",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ConflictError when provider already added", async () => {
      vi.mocked(queries.getModelProvider).mockResolvedValue(mockModelProvider);

      await expect(
        modelService.addProvider("model-123", {
          provider_id: "provider-123",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("removeProvider", () => {
    it("should remove provider from model", async () => {
      await expect(
        modelService.removeProvider("model-123", "provider-123")
      ).resolves.not.toThrow();

      expect(queries.removeModelProvider).toHaveBeenCalledWith(
        expect.anything(),
        "model-123",
        "provider-123"
      );
    });

    it("should throw NotFoundError when provider not found", async () => {
      vi.mocked(queries.getModelProvider).mockResolvedValue(null);

      await expect(
        modelService.removeProvider("model-123", "non-existent")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("listProviders", () => {
    it("should list providers for model", async () => {
      const result = await modelService.listProviders("model-123");

      expect(result).toHaveLength(1);
      expect(result[0].provider_id).toBe("provider-123");
    });

    it("should return empty array when no providers", async () => {
      vi.mocked(queries.getProvidersForModel).mockResolvedValue([]);

      const result = await modelService.listProviders("model-123");

      expect(result).toEqual([]);
    });
  });
});
