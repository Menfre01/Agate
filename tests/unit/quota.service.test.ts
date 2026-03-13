/**
 * Unit tests for QuotaService.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { QuotaService } from "@/services/quota.service.js";
import type { ApiKey, User, Company, Department, Env } from "@/types/index.js";

// Mock queries module
vi.mock("@/db/queries.js", () => ({
  getApiKey: vi.fn(),
  getUser: vi.fn(),
  getCompany: vi.fn(),
  getDepartment: vi.fn(),
  resetApiKeyQuota: vi.fn(),
  resetUserQuota: vi.fn(),
  resetDepartmentQuota: vi.fn(),
  resetCompanyQuota: vi.fn(),
  deductApiKeyQuota: vi.fn(),
  deductUserQuota: vi.fn(),
  deductDepartmentDailyQuota: vi.fn(),
  deductDepartmentMixedQuota: vi.fn(),
  deductCompanyDailyQuota: vi.fn(),
  deductCompanyMixedQuota: vi.fn(),
  createQuotaChange: vi.fn(),
}));

import * as queries from "@/db/queries.js";

describe("QuotaService", () => {
  let quotaService: QuotaService;
  let mockEnv: Env;

  const mockApiKey: ApiKey = {
    id: "key-123",
    key_hash: "hash-abc",
    key_prefix: "sk-test...",
    user_id: "user-123",
    company_id: "company-123",
    department_id: "dept-123",
    name: "Test Key",
    quota_daily: 10000,
    quota_used: 1000,
    quota_bonus: 500,
    quota_bonus_expiry: Date.now() + 86400000,
    is_unlimited: false,
    is_active: true,
    last_reset_at: Date.now(),
    last_used_at: Date.now(),
    expires_at: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    company_id: "company-123",
    department_id: "dept-123",
    role: "user",
    quota_daily: 10000,
    quota_used: 500,
    is_active: true,
    last_reset_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const mockCompany: Company = {
    id: "company-123",
    name: "Test Company",
    quota_pool: 1000000,
    quota_used: 50000,
    quota_daily: 100000,
    daily_used: 5000,
    last_reset_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const mockDepartment: Department = {
    id: "dept-123",
    company_id: "company-123",
    name: "Test Department",
    quota_pool: 100000,
    quota_used: 5000,
    quota_daily: 50000,
    daily_used: 2500,
    last_reset_at: Date.now(),
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
    vi.mocked(queries.getApiKey).mockResolvedValue(mockApiKey);
    vi.mocked(queries.getUser).mockResolvedValue(mockUser);
    vi.mocked(queries.getCompany).mockResolvedValue(mockCompany);
    vi.mocked(queries.getDepartment).mockResolvedValue(mockDepartment);
    vi.mocked(queries.resetApiKeyQuota).mockResolvedValue(mockApiKey);
    vi.mocked(queries.resetUserQuota).mockResolvedValue(mockUser);
    vi.mocked(queries.resetDepartmentQuota).mockResolvedValue(mockDepartment);
    vi.mocked(queries.resetCompanyQuota).mockResolvedValue(mockCompany);
    vi.mocked(queries.deductApiKeyQuota).mockResolvedValue(mockApiKey);
    vi.mocked(queries.deductUserQuota).mockResolvedValue(mockUser);
    vi.mocked(queries.deductDepartmentDailyQuota).mockResolvedValue(mockDepartment);
    vi.mocked(queries.deductDepartmentMixedQuota).mockResolvedValue(mockDepartment);
    vi.mocked(queries.deductCompanyDailyQuota).mockResolvedValue(mockCompany);
    vi.mocked(queries.deductCompanyMixedQuota).mockResolvedValue(mockCompany);
    vi.mocked(queries.createQuotaChange).mockResolvedValue(undefined);

    quotaService = new QuotaService(mockEnv);
  });

  describe("checkQuota", () => {
    it("should allow request when quota is sufficient", async () => {
      const result = await quotaService.checkQuota(
        mockApiKey,
        mockUser,
        mockDepartment,
        mockCompany,
        1000
      );

      expect(result.allowed).toBe(true);
    });

    it("should allow unlimited keys regardless of quota", async () => {
      const unlimitedKey = { ...mockApiKey, is_unlimited: true };

      const result = await quotaService.checkQuota(
        unlimitedKey,
        mockUser,
        mockDepartment,
        mockCompany,
        1000000
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining.apiKeyDaily).toBe(Infinity);
    });

    it("should include valid bonus in available quota", async () => {
      const result = await quotaService.checkQuota(
        mockApiKey,
        mockUser,
        mockDepartment,
        mockCompany,
        5000
      );

      // Daily remaining (9000) + Bonus (500)
      expect(result.remaining.apiKeyDaily).toBe(9500);
    });
  });

  describe("deductQuota", () => {
    it("should deduct quota from all levels", async () => {
      const result = await quotaService.deductQuota(
        "key-123",
        "user-123",
        "dept-123",
        "company-123",
        1000
      );

      expect(result.tokens).toBe(1000);
      expect(result.updated.apiKey).toBeDefined();
      expect(result.updated.user).toBeDefined();
      expect(result.updated.company).toBeDefined();
    });

    it("should handle requests without department", async () => {
      vi.mocked(queries.getDepartment).mockResolvedValue(null);

      const result = await quotaService.deductQuota(
        "key-123",
        "user-123",
        null,
        "company-123",
        1000
      );

      expect(result.tokens).toBe(1000);
      expect(result.updated.department).toBeUndefined();
    });
  });

  describe("recordQuotaChange", () => {
    it("should record quota change", async () => {
      await expect(
        quotaService.recordQuotaChange(
          "api_key",
          "key-123",
          "add",
          1000,
          5000,
          6000,
          "Bonus added"
        )
      ).resolves.not.toThrow();
    });
  });
});
