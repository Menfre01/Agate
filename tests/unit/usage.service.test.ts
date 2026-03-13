/**
 * Unit tests for UsageService.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { UsageService } from "@/services/usage.service.js";
import type { Env } from "@/types/index.js";

// Mock queries module
vi.mock("@/db/queries.js", () => ({
  createUsageLog: vi.fn(),
  queryUsageLogs: vi.fn(),
  getUsageStats: vi.fn(),
  getUsageStatsGrouped: vi.fn(),
  getTokenUsageSummary: vi.fn(),
  getTokenUsageByModel: vi.fn(),
  getTotalCost: vi.fn(),
  getCostByModel: vi.fn(),
  getCostByProvider: vi.fn(),
  getModelStats: vi.fn(),
  updateApiKeyLastUsed: vi.fn(),
}));

import * as queries from "@/db/queries.js";

describe("UsageService", () => {
  let usageService: UsageService;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      DB: {} as unknown as D1Database,
      CACHE: {} as KVNamespace,
      ENCRYPTION_KEY: "test-key",
    };

    // Setup mock returns
    vi.mocked(queries.createUsageLog).mockResolvedValue(undefined);
    vi.mocked(queries.queryUsageLogs).mockResolvedValue({ logs: [], total: 0 });
    vi.mocked(queries.getUsageStats).mockResolvedValue({});
    vi.mocked(queries.getUsageStatsGrouped).mockResolvedValue([]);
    vi.mocked(queries.getTokenUsageSummary).mockResolvedValue({});
    vi.mocked(queries.getTokenUsageByModel).mockResolvedValue([]);
    vi.mocked(queries.getTotalCost).mockResolvedValue({});
    vi.mocked(queries.getCostByModel).mockResolvedValue([]);
    vi.mocked(queries.getCostByProvider).mockResolvedValue([]);
    vi.mocked(queries.getModelStats).mockResolvedValue([]);
    vi.mocked(queries.updateApiKeyLastUsed).mockResolvedValue(undefined);

    usageService = new UsageService(mockEnv);
  });

  describe("recordUsage", () => {
    it("should record usage log", async () => {
      const logId = await usageService.recordUsage({
        apiKeyId: "key-123",
        userId: "user-123",
        companyId: "company-123",
        departmentId: "dept-123",
        providerId: "provider-123",
        modelId: "model-123",
        modelName: "claude-3-sonnet",
        endpoint: "/v1/messages",
        inputTokens: 100,
        outputTokens: 50,
        status: "success",
      });

      expect(logId).toBeDefined();
    });

    it("should calculate total tokens correctly", async () => {
      const logId = await usageService.recordUsage({
        apiKeyId: "key-123",
        userId: "user-123",
        companyId: "company-123",
        departmentId: null,
        providerId: "provider-123",
        modelId: "model-123",
        modelName: "claude-3-sonnet",
        endpoint: "/v1/messages",
        inputTokens: 500,
        outputTokens: 300,
        status: "success",
      });

      expect(logId).toBeDefined();
    });

    it("should record error status", async () => {
      const logId = await usageService.recordUsage({
        apiKeyId: "key-123",
        userId: "user-123",
        companyId: "company-123",
        departmentId: null,
        providerId: "provider-123",
        modelId: "model-123",
        modelName: "claude-3-sonnet",
        endpoint: "/v1/messages",
        inputTokens: 0,
        outputTokens: 0,
        status: "error",
        errorCode: "rate_limit_exceeded",
      });

      expect(logId).toBeDefined();
    });
  });

  describe("queryLogs", () => {
    it("should return paginated results", async () => {
      const result = await usageService.queryLogs({ page: 1, page_size: 50 });

      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("logs");
      expect(result.logs).toEqual([]);
    });

    it("should use default pagination", async () => {
      const result = await usageService.queryLogs({});

      expect(result.page_size).toBe(50);
      expect(result.page).toBe(1);
    });
  });

  describe("updateLastUsed", () => {
    it("should update last_used_at timestamp", async () => {
      await expect(
        usageService.updateLastUsed("key-123")
      ).resolves.not.toThrow();
    });
  });
});
