/**
 * Unit tests for ModelService.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ModelService } from "@/services/model.service.js";
import type { Model, Env } from "@/types/index.js";
import { NotFoundError, ValidationError } from "@/utils/errors/index.js";

// Mock queries module
vi.mock("@/db/queries.js", () => ({
  getModel: vi.fn(),
  getModelByModelId: vi.fn(),
  listModels: vi.fn(),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  deleteModel: vi.fn(),
  listModelProvidersByModel: vi.fn(),
  createModelProvider: vi.fn(),
  deleteModelProvider: vi.fn(),
  getModelProvider: vi.fn(),
  getDepartmentModel: vi.fn(),
  createDepartmentModel: vi.fn(),
  updateDepartmentModel: vi.fn(),
  listDepartmentModels: vi.fn(),
  getDepartment: vi.fn(),
  getProvider: vi.fn(),
}));

import * as queries from "@/db/queries.js";

describe("ModelService", () => {
  let modelService: ModelService;
  let mockEnv: Env;

  const mockModel: Model = {
    id: "model-123",
    model_id: "claude-3-sonnet",
    display_name: "Claude 3 Sonnet",
    context_window: 200000,
    max_tokens: 4096,
    is_active: true,
    created_at: Date.now(),
    updated_at: Date.now(),
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
    vi.mocked(queries.listModels).mockResolvedValue([mockModel]);
    vi.mocked(queries.createModel).mockResolvedValue(mockModel);
    vi.mocked(queries.updateModel).mockResolvedValue(mockModel);
    vi.mocked(queries.deleteModel).mockResolvedValue(undefined);
    vi.mocked(queries.listModelProvidersByModel).mockResolvedValue([]);
    vi.mocked(queries.createModelProvider).mockResolvedValue(undefined);
    vi.mocked(queries.deleteModelProvider).mockResolvedValue(undefined);
    vi.mocked(queries.getModelProvider).mockResolvedValue(null);
    vi.mocked(queries.getDepartmentModel).mockResolvedValue(null);
    vi.mocked(queries.createDepartmentModel).mockResolvedValue(undefined);
    vi.mocked(queries.updateDepartmentModel).mockResolvedValue(undefined);
    vi.mocked(queries.listDepartmentModels).mockResolvedValue([]);
    vi.mocked(queries.getDepartment).mockResolvedValue({ name: "Test Dept" });
    vi.mocked(queries.getProvider).mockResolvedValue(null);

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
  });
});
