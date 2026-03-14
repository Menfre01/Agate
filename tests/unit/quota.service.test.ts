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
  updateCompany: vi.fn(),
  updateDepartment: vi.fn(),
  updateApiKey: vi.fn(),
  addApiKeyBonus: vi.fn(),
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
    last_reset_at: Date.now(), // Use current time to avoid reset logic
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
    last_reset_at: Date.now(), // Use current time to avoid reset logic
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
    last_reset_at: Date.now(), // Use current time to avoid reset logic
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
    last_reset_at: Date.now(), // Use current time to avoid reset logic
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
    vi.mocked(queries.updateCompany).mockResolvedValue(mockCompany);
    vi.mocked(queries.updateDepartment).mockResolvedValue(mockDepartment);
    vi.mocked(queries.updateApiKey).mockResolvedValue(mockApiKey);
    vi.mocked(queries.addApiKeyBonus).mockResolvedValue(mockApiKey);

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
      expect(result.remaining.userDaily).toBe(Infinity);
      expect(result.remaining.companyDaily).toBe(Infinity);
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

    it("should exclude expired bonus from available quota", async () => {
      const expiredBonusKey = {
        ...mockApiKey,
        quota_bonus: 1000,
        quota_bonus_expiry: Date.now() - 1000, // Expired
      };

      // Mock the fresh data returned after reset check
      vi.mocked(queries.getApiKey).mockResolvedValue(expiredBonusKey);
      vi.mocked(queries.getUser).mockResolvedValue(mockUser);
      vi.mocked(queries.getDepartment).mockResolvedValue(mockDepartment);
      vi.mocked(queries.getCompany).mockResolvedValue(mockCompany);

      const result = await quotaService.checkQuota(
        expiredBonusKey,
        mockUser,
        mockDepartment,
        mockCompany,
        5000
      );

      // Only daily remaining (10000 - 1000 = 9000), no bonus since expired
      expect(result.remaining.apiKeyDaily).toBe(9000);
    });

    it("should reject when API key quota insufficient", async () => {
      const lowQuotaKey = {
        ...mockApiKey,
        quota_daily: 100,
        quota_used: 90,
        quota_bonus: 0,
        last_reset_at: Date.now(),
      };

      // Mock the fresh data returned after reset check
      vi.mocked(queries.getApiKey).mockResolvedValue(lowQuotaKey);
      vi.mocked(queries.getUser).mockResolvedValue(mockUser);
      vi.mocked(queries.getDepartment).mockResolvedValue(mockDepartment);
      vi.mocked(queries.getCompany).mockResolvedValue(mockCompany);

      const result = await quotaService.checkQuota(
        lowQuotaKey,
        mockUser,
        mockDepartment,
        mockCompany,
        20
      );

      expect(result.allowed).toBe(false);
      expect(result.failedAt).toBe("apiKey");
      expect(result.remaining.apiKeyDaily).toBe(10); // 100 - 90 = 10 remaining
    });

    it("should reject when user quota insufficient", async () => {
      const lowQuotaUser = {
        ...mockUser,
        quota_daily: 100,
        quota_used: 95,
        last_reset_at: Date.now(),
      };

      // Mock the fresh data returned after reset check
      vi.mocked(queries.getApiKey).mockResolvedValue(mockApiKey);
      vi.mocked(queries.getUser).mockResolvedValue(lowQuotaUser);
      vi.mocked(queries.getDepartment).mockResolvedValue(mockDepartment);
      vi.mocked(queries.getCompany).mockResolvedValue(mockCompany);

      const result = await quotaService.checkQuota(
        mockApiKey,
        lowQuotaUser,
        mockDepartment,
        mockCompany,
        10
      );

      expect(result.allowed).toBe(false);
      expect(result.failedAt).toBe("user");
      expect(result.remaining.userDaily).toBe(5); // 100 - 95 = 5 remaining
    });

    it("should reject when department quota insufficient", async () => {
      const lowQuotaDept = {
        ...mockDepartment,
        quota_daily: 100,
        daily_used: 95,
        quota_pool: 0,
        quota_used: 0,
      };

      vi.mocked(queries.getDepartment).mockResolvedValue(lowQuotaDept);

      const result = await quotaService.checkQuota(
        mockApiKey,
        mockUser,
        lowQuotaDept,
        mockCompany,
        10
      );

      expect(result.allowed).toBe(false);
      expect(result.failedAt).toBe("department");
    });

    it("should reject when company quota insufficient", async () => {
      const lowQuotaCompany = {
        ...mockCompany,
        quota_daily: 100,
        daily_used: 90,
        quota_pool: 0,
        quota_used: 0,
      };

      vi.mocked(queries.getCompany).mockResolvedValue(lowQuotaCompany);

      const result = await quotaService.checkQuota(
        mockApiKey,
        mockUser,
        mockDepartment,
        lowQuotaCompany,
        20
      );

      expect(result.allowed).toBe(false);
      expect(result.failedAt).toBe("company");
    });

    it("should handle null department", async () => {
      const result = await quotaService.checkQuota(
        mockApiKey,
        mockUser,
        null,
        mockCompany,
        1000
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining.departmentDaily).toBeNull();
      expect(result.remaining.departmentPool).toBeNull();
    });

    it("should use department pool when daily insufficient", async () => {
      const deptWithPool = {
        ...mockDepartment,
        quota_daily: 100,
        daily_used: 95,
        quota_pool: 1000,
        quota_used: 100,
      };

      vi.mocked(queries.getDepartment).mockResolvedValue(deptWithPool);

      const result = await quotaService.checkQuota(
        mockApiKey,
        mockUser,
        deptWithPool,
        mockCompany,
        10
      );

      // Should be allowed because pool has quota
      expect(result.allowed).toBe(true);
    });

    it("should use company pool when daily insufficient", async () => {
      const companyWithPool = {
        ...mockCompany,
        quota_daily: 100,
        daily_used: 90,
        quota_pool: 10000,
        quota_used: 1000,
      };

      vi.mocked(queries.getCompany).mockResolvedValue(companyWithPool);

      const result = await quotaService.checkQuota(
        mockApiKey,
        mockUser,
        mockDepartment,
        companyWithPool,
        20
      );

      // Should be allowed because pool has quota
      expect(result.allowed).toBe(true);
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

    it("should deduct from department daily quota when sufficient", async () => {
      const deptWithDaily = {
        ...mockDepartment,
        quota_daily: 10000,
        daily_used: 1000,
        quota_pool: 50000,
        quota_used: 5000,
      };
      vi.mocked(queries.getDepartment).mockResolvedValue(deptWithDaily);
      vi.mocked(queries.deductDepartmentDailyQuota).mockResolvedValue(deptWithDaily);

      const result = await quotaService.deductQuota(
        "key-123",
        "user-123",
        "dept-123",
        "company-123",
        1000
      );

      expect(result.tokens).toBe(1000);
      expect(queries.deductDepartmentDailyQuota).toHaveBeenCalled();
    });

    it("should deduct from department pool when daily insufficient", async () => {
      const deptLowDaily = {
        ...mockDepartment,
        quota_daily: 100,
        daily_used: 90,
        quota_pool: 50000,
        quota_used: 5000,
      };
      vi.mocked(queries.getDepartment).mockResolvedValue(deptLowDaily);
      vi.mocked(queries.deductDepartmentMixedQuota).mockResolvedValue(deptLowDaily);

      const result = await quotaService.deductQuota(
        "key-123",
        "user-123",
        "dept-123",
        "company-123",
        50
      );

      expect(result.tokens).toBe(50);
      expect(queries.deductDepartmentMixedQuota).toHaveBeenCalledWith(
        expect.anything(),
        "dept-123",
        10, // remaining daily
        40  // from pool
      );
    });

    it("should deduct from company daily quota when sufficient", async () => {
      const companyWithDaily = {
        ...mockCompany,
        quota_daily: 100000,
        daily_used: 10000,
        quota_pool: 500000,
        quota_used: 50000,
      };
      vi.mocked(queries.getCompany).mockResolvedValue(companyWithDaily);
      vi.mocked(queries.deductCompanyDailyQuota).mockResolvedValue(companyWithDaily);

      const result = await quotaService.deductQuota(
        "key-123",
        "user-123",
        "dept-123",
        "company-123",
        1000
      );

      expect(queries.deductCompanyDailyQuota).toHaveBeenCalled();
    });

    it("should deduct from company pool when daily insufficient", async () => {
      const companyLowDaily = {
        ...mockCompany,
        quota_daily: 100,
        daily_used: 90,
        quota_pool: 500000,
        quota_used: 50000,
      };
      vi.mocked(queries.getCompany).mockResolvedValue(companyLowDaily);
      vi.mocked(queries.deductCompanyMixedQuota).mockResolvedValue(companyLowDaily);

      const result = await quotaService.deductQuota(
        "key-123",
        "user-123",
        "dept-123",
        "company-123",
        50
      );

      expect(queries.deductCompanyMixedQuota).toHaveBeenCalledWith(
        expect.anything(),
        "company-123",
        10, // remaining daily
        40  // from pool
      );
    });

    it("should throw error when department not found during deduction", async () => {
      vi.mocked(queries.getDepartment).mockResolvedValue(null);

      await expect(
        quotaService.deductQuota(
          "key-123",
          "user-123",
          "dept-123",
          "company-123",
          1000
        )
      ).rejects.toThrow("Department not found");
    });

    it("should throw error when company not found during deduction", async () => {
      vi.mocked(queries.getCompany).mockResolvedValue(null);

      await expect(
        quotaService.deductQuota(
          "key-123",
          "user-123",
          null,
          "company-123",
          1000
        )
      ).rejects.toThrow("Company not found");
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

    it("should record quota change without reason", async () => {
      await expect(
        quotaService.recordQuotaChange(
          "company",
          "comp-123",
          "reset",
          -5000,
          5000,
          0
        )
      ).resolves.not.toThrow();
    });

    it("should record quota change with createdBy", async () => {
      await expect(
        quotaService.recordQuotaChange(
          "department",
          "dept-123",
          "set",
          10000,
          50000,
          60000,
          "Increase quota",
          "admin-123"
        )
      ).resolves.not.toThrow();
    });
  });

  describe("setQuota", () => {
    it("should set company pool quota", async () => {
      const updatedCompany = { ...mockCompany, quota_pool: 500000 };
      vi.mocked(queries.updateCompany).mockResolvedValue(updatedCompany);

      await expect(
        quotaService.setQuota("company", "company-123", "pool", 500000)
      ).resolves.not.toThrow();

      expect(queries.updateCompany).toHaveBeenCalledWith(
        expect.anything(),
        "company-123",
        { quota_pool: 500000 }
      );
    });

    it("should set company daily quota", async () => {
      const updatedCompany = { ...mockCompany, quota_daily: 50000 };
      vi.mocked(queries.updateCompany).mockResolvedValue(updatedCompany);

      await expect(
        quotaService.setQuota("company", "company-123", "daily", 50000)
      ).resolves.not.toThrow();

      expect(queries.updateCompany).toHaveBeenCalledWith(
        expect.anything(),
        "company-123",
        { quota_daily: 50000 }
      );
    });

    it("should set department pool quota", async () => {
      const updatedDept = { ...mockDepartment, quota_pool: 50000 };
      vi.mocked(queries.updateDepartment).mockResolvedValue(updatedDept);

      await expect(
        quotaService.setQuota("department", "dept-123", "pool", 50000)
      ).resolves.not.toThrow();
    });

    it("should set api_key daily quota", async () => {
      const updatedKey = { ...mockApiKey, quota_daily: 5000 };
      vi.mocked(queries.updateApiKey).mockResolvedValue(updatedKey);

      await expect(
        quotaService.setQuota("api_key", "key-123", "daily", 5000)
      ).resolves.not.toThrow();
    });

    it("should throw error when company not found", async () => {
      vi.mocked(queries.getCompany).mockResolvedValue(null);

      await expect(
        quotaService.setQuota("company", "non-existent", "pool", 1000)
      ).rejects.toThrow("Company not found");
    });

    it("should throw error when department not found", async () => {
      vi.mocked(queries.getDepartment).mockResolvedValue(null);

      await expect(
        quotaService.setQuota("department", "non-existent", "pool", 1000)
      ).rejects.toThrow("Department not found");
    });

    it("should throw error when api_key not found", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      await expect(
        quotaService.setQuota("api_key", "non-existent", "daily", 1000)
      ).rejects.toThrow("API Key not found");
    });

    it("should record quota change after setting", async () => {
      const updatedCompany = { ...mockCompany, quota_pool: 500000 };
      vi.mocked(queries.updateCompany).mockResolvedValue(updatedCompany);

      await quotaService.setQuota("company", "company-123", "pool", 500000, "Manual increase");

      expect(queries.createQuotaChange).toHaveBeenCalled();
    });
  });

  describe("resetQuota", () => {
    it("should reset company quota", async () => {
      await expect(
        quotaService.resetQuota("company", "company-123")
      ).resolves.not.toThrow();

      expect(queries.resetCompanyQuota).toHaveBeenCalledWith(
        expect.anything(),
        "company-123"
      );
    });

    it("should reset department quota", async () => {
      await expect(
        quotaService.resetQuota("department", "dept-123")
      ).resolves.not.toThrow();

      expect(queries.resetDepartmentQuota).toHaveBeenCalledWith(
        expect.anything(),
        "dept-123"
      );
    });

    it("should reset api_key quota", async () => {
      await expect(
        quotaService.resetQuota("api_key", "key-123")
      ).resolves.not.toThrow();

      expect(queries.resetApiKeyQuota).toHaveBeenCalledWith(
        expect.anything(),
        "key-123"
      );
    });

    it("should throw error when company not found", async () => {
      vi.mocked(queries.getCompany).mockResolvedValue(null);

      await expect(
        quotaService.resetQuota("company", "non-existent")
      ).rejects.toThrow("Company not found");
    });

    it("should record quota change after reset", async () => {
      await quotaService.resetQuota("company", "company-123", "Admin reset");

      expect(queries.createQuotaChange).toHaveBeenCalled();
    });
  });

  describe("addBonusQuota", () => {
    it("should add bonus to company pool", async () => {
      const updatedCompany = { ...mockCompany, quota_pool: 1050000 };
      vi.mocked(queries.updateCompany).mockResolvedValue(updatedCompany);

      await expect(
        quotaService.addBonusQuota("company", "company-123", 50000)
      ).resolves.not.toThrow();

      expect(queries.updateCompany).toHaveBeenCalledWith(
        expect.anything(),
        "company-123",
        { quota_pool: 1050000 }
      );
    });

    it("should add bonus to department pool", async () => {
      const updatedDept = { ...mockDepartment, quota_pool: 150000 };
      vi.mocked(queries.updateDepartment).mockResolvedValue(updatedDept);

      await expect(
        quotaService.addBonusQuota("department", "dept-123", 50000)
      ).resolves.not.toThrow();
    });

    it("should add bonus to api_key", async () => {
      const updatedKey = { ...mockApiKey, quota_bonus: 1500 };
      vi.mocked(queries.addApiKeyBonus).mockResolvedValue(updatedKey);

      await expect(
        quotaService.addBonusQuota("api_key", "key-123", 500)
      ).resolves.not.toThrow();
    });

    it("should add bonus with expiry to api_key", async () => {
      const expiry = Date.now() + 86400000;
      const updatedKey = { ...mockApiKey, quota_bonus: 1500, quota_bonus_expiry: expiry };
      vi.mocked(queries.addApiKeyBonus).mockResolvedValue(updatedKey);

      await quotaService.addBonusQuota("api_key", "key-123", 500, expiry);
      expect(queries.addApiKeyBonus).toHaveBeenCalled();
    });

    it("should throw error when company not found", async () => {
      vi.mocked(queries.getCompany).mockResolvedValue(null);

      await expect(
        quotaService.addBonusQuota("company", "non-existent", 1000)
      ).rejects.toThrow("Company not found");
    });

    it("should record quota change after adding bonus", async () => {
      const updatedCompany = { ...mockCompany, quota_pool: 1050000 };
      vi.mocked(queries.updateCompany).mockResolvedValue(updatedCompany);

      await quotaService.addBonusQuota("company", "company-123", 50000, undefined, "Quarterly bonus");

      expect(queries.createQuotaChange).toHaveBeenCalled();
    });
  });

  describe("getQuotaInfo", () => {
    it("should get company quota info", async () => {
      const info = await quotaService.getQuotaInfo("company", "company-123");

      expect(info.entity_type).toBe("company");
      expect(info.entity_id).toBe("company-123");
      expect(info.entity_name).toBe("Test Company");
      expect(info.quota_pool).toBe(1000000);
      expect(info.quota_daily).toBe(100000);
    });

    it("should get department quota info", async () => {
      const info = await quotaService.getQuotaInfo("department", "dept-123");

      expect(info.entity_type).toBe("department");
      expect(info.entity_id).toBe("dept-123");
      expect(info.entity_name).toBe("Test Department");
    });

    it("should get api_key quota info", async () => {
      const info = await quotaService.getQuotaInfo("api_key", "key-123");

      expect(info.entity_type).toBe("api_key");
      expect(info.entity_id).toBe("key-123");
      expect(info.quota_daily).toBe(10000);
      expect(info.quota_pool).toBe(0); // API keys don't have pool
    });

    it("should throw error when company not found", async () => {
      vi.mocked(queries.getCompany).mockResolvedValue(null);

      await expect(
        quotaService.getQuotaInfo("company", "non-existent")
      ).rejects.toThrow("Company not found");
    });

    it("should throw error when department not found", async () => {
      vi.mocked(queries.getDepartment).mockResolvedValue(null);

      await expect(
        quotaService.getQuotaInfo("department", "non-existent")
      ).rejects.toThrow("Department not found");
    });

    it("should throw error when api_key not found", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      await expect(
        quotaService.getQuotaInfo("api_key", "non-existent")
      ).rejects.toThrow("API Key not found");
    });
  });
});
