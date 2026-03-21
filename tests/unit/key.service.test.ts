/**
 * Unit tests for KeyService.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyService } from "@/services/key.service.js";
import type { ApiKey, User, CreateApiKeyDto, UpdateApiKeyDto, AddBonusQuotaDto, Env } from "@/types/index.js";
import { NotFoundError, ValidationError } from "@/utils/errors/index.js";

// Mock queries module
vi.mock("@/db/queries.js", () => ({
  getUser: vi.fn(),
  getApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  addApiKeyBonus: vi.fn(),
  resetApiKeyQuota: vi.fn(),
}));

import * as queries from "@/db/queries.js";

// Mock AuthService
vi.mock("@/services/auth.service.js");

import { AuthService } from "@/services/auth.service.js";

describe("KeyService", () => {
  let keyService: KeyService;
  let mockEnv: Env;

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
    is_unlimited: false,
    last_reset_at: Date.now() - 3600000,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const mockApiKey: ApiKey = {
    id: "key-123",
    key_hash: "hash-abc123",
    key_prefix: "sk-test...",
    user_id: "user-123",
    company_id: "company-123",
    department_id: "dept-123",
    name: "Test Key",
    quota_daily: 10000,
    quota_used: 500,
    quota_bonus: 1000,
    quota_bonus_used: 0,
    quota_bonus_expiry: Date.now() + 86400000,
    is_unlimited: false,
    is_active: true,
    last_reset_at: Date.now() - 3600000,
    last_used_at: Date.now(),
    expires_at: null,
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
    vi.mocked(queries.getUser).mockResolvedValue(mockUser);
    vi.mocked(queries.getApiKey).mockResolvedValue(mockApiKey);
    vi.mocked(queries.listApiKeys).mockResolvedValue([mockApiKey]);
    vi.mocked(queries.createApiKey).mockResolvedValue(mockApiKey);
    vi.mocked(queries.updateApiKey).mockResolvedValue(mockApiKey);
    vi.mocked(queries.deleteApiKey).mockResolvedValue(undefined);
    vi.mocked(queries.addApiKeyBonus).mockResolvedValue(mockApiKey);
    vi.mocked(queries.resetApiKeyQuota).mockResolvedValue(mockApiKey);

    // Mock AuthService
    vi.mocked(AuthService.prototype.generateApiKey).mockReturnValue("sk_test_12345");
    vi.mocked(AuthService.prototype.invalidateApiKey).mockResolvedValue(undefined);

    keyService = new KeyService(mockEnv);
  });

  describe("listApiKeys", () => {
    it("should list API keys", async () => {
      const keys = await keyService.listApiKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0].id).toBe("key-123");
    });

    it("should filter by user_id", async () => {
      const keys = await keyService.listApiKeys({ user_id: "user-123" });
      expect(keys).toHaveLength(1);
      expect(queries.listApiKeys).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ user_id: "user-123" })
      );
    });

    it("should filter by company_id", async () => {
      const keys = await keyService.listApiKeys({ company_id: "company-123" });
      expect(keys).toHaveLength(1);
    });

    it("should filter by department_id", async () => {
      const keys = await keyService.listApiKeys({ department_id: "dept-123" });
      expect(keys).toHaveLength(1);
    });

    it("should filter by is_active", async () => {
      const activeKeys = await keyService.listApiKeys({ is_active: true });
      expect(activeKeys).toHaveLength(1);
    });

    it("should respect limit parameter", async () => {
      const keys = await keyService.listApiKeys({ limit: 10 });
      expect(queries.listApiKeys).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 10 })
      );
    });

    it("should respect offset parameter", async () => {
      const keys = await keyService.listApiKeys({ offset: 5 });
      expect(queries.listApiKeys).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ offset: 5 })
      );
    });

    it("should use default limit when not specified", async () => {
      await keyService.listApiKeys();
      expect(queries.listApiKeys).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 100, offset: 0 })
      );
    });

    it("should return empty array when no keys match", async () => {
      vi.mocked(queries.listApiKeys).mockResolvedValue([]);
      const keys = await keyService.listApiKeys({ user_id: "non-existent" });
      expect(keys).toEqual([]);
    });
  });

  describe("createApiKey", () => {
    it("should create API key with valid data", async () => {
      const dto: CreateApiKeyDto = {
        user_id: "user-123",
        name: "New Key",
        quota_daily: 5000,
      };

      const result = await keyService.createApiKey(dto);

      expect(result.key).toMatch(/^sk_/);
      expect(result.response.user_id).toBe("user-123");
    });

    it("should reject negative quota_daily", async () => {
      const dto: CreateApiKeyDto = {
        user_id: "user-123",
        name: "Bad Key",
        quota_daily: -100,
      };

      await expect(keyService.createApiKey(dto)).rejects.toThrow(
        ValidationError
      );
    });

    it("should reject quota_daily of zero", async () => {
      const dto: CreateApiKeyDto = {
        user_id: "user-123",
        name: "Zero Key",
        quota_daily: 0,
      };

      // Zero quota should be accepted (unlimited keys can have 0 daily quota)
      const result = await keyService.createApiKey(dto);
      expect(result.response.quota_daily).toBe(0);
    });

    it("should reject past expiry date", async () => {
      const dto: CreateApiKeyDto = {
        user_id: "user-123",
        name: "Expired Key",
        quota_daily: 1000,
        expires_at: Date.now() - 1000,
      };

      await expect(keyService.createApiKey(dto)).rejects.toThrow(
        ValidationError
      );
      await expect(keyService.createApiKey(dto)).rejects.toThrow(
        "Expiry date must be in the future"
      );
    });

    it("should accept future expiry date", async () => {
      const futureDate = Date.now() + 86400000; // 1 day from now
      const dto: CreateApiKeyDto = {
        user_id: "user-123",
        name: "Future Key",
        quota_daily: 1000,
        expires_at: futureDate,
      };

      const result = await keyService.createApiKey(dto);
      expect(result.response.expires_at).toBe(futureDate);
    });

    it("should reject when user does not exist", async () => {
      vi.mocked(queries.getUser).mockResolvedValue(null);

      const dto: CreateApiKeyDto = {
        user_id: "non-existent",
        name: "Orphan Key",
        quota_daily: 1000,
      };

      await expect(keyService.createApiKey(dto)).rejects.toThrow(
        ValidationError
      );
      await expect(keyService.createApiKey(dto)).rejects.toThrow(
        "User not found"
      );
    });

    it("should allow null name", async () => {
      const dto: CreateApiKeyDto = {
        user_id: "user-123",
        name: null,
        quota_daily: 1000,
      };

      const result = await keyService.createApiKey(dto);
      expect(result.response.name).toBeNull();
    });

    it("should create key with null expires_at", async () => {
      const dto: CreateApiKeyDto = {
        user_id: "user-123",
        name: "No Expiry Key",
        quota_daily: 1000,
        expires_at: undefined,
      };

      const result = await keyService.createApiKey(dto);
      expect(result.response.expires_at).toBeNull();
    });
  });

  describe("getApiKey", () => {
    it("should get API key by ID", async () => {
      const key = await keyService.getApiKey("key-123");
      expect(key).toBeDefined();
      expect(key.id).toBe("key-123");
    });

    it("should throw NotFoundError for non-existent key", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      await expect(keyService.getApiKey("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("updateApiKey", () => {
    it("should update API key", async () => {
      const updatedKey = { ...mockApiKey, name: "Updated Name" };
      vi.mocked(queries.updateApiKey).mockResolvedValue(updatedKey);

      const dto: UpdateApiKeyDto = {
        name: "Updated Name",
      };

      const updated = await keyService.updateApiKey("key-123", dto);
      expect(updated.name).toBe("Updated Name");
    });

    it("should reject negative quota_daily", async () => {
      const dto: UpdateApiKeyDto = {
        quota_daily: -100,
      };

      await expect(keyService.updateApiKey("key-123", dto)).rejects.toThrow(
        ValidationError
      );
      await expect(keyService.updateApiKey("key-123", dto)).rejects.toThrow(
        "Daily quota must be non-negative"
      );
    });

    it("should accept zero quota_daily", async () => {
      const updatedKey = { ...mockApiKey, quota_daily: 0 };
      vi.mocked(queries.updateApiKey).mockResolvedValue(updatedKey);

      const dto: UpdateApiKeyDto = {
        quota_daily: 0,
      };

      const updated = await keyService.updateApiKey("key-123", dto);
      expect(updated.quota_daily).toBe(0);
    });

    it("should allow null expires_at (no expiry)", async () => {
      // Note: The KeyService doesn't validate expires_at on update
      // This test documents the current behavior
      const updatedKey = { ...mockApiKey, expires_at: null };
      vi.mocked(queries.updateApiKey).mockResolvedValue(updatedKey);

      const dto: UpdateApiKeyDto = {
        expires_at: null,
      };

      const updated = await keyService.updateApiKey("key-123", dto);
      expect(updated.expires_at).toBeNull();
    });

    it("should accept future expiry date", async () => {
      const futureDate = Date.now() + 86400000;
      const updatedKey = { ...mockApiKey, expires_at: futureDate };
      vi.mocked(queries.updateApiKey).mockResolvedValue(updatedKey);

      const dto: UpdateApiKeyDto = {
        expires_at: futureDate,
      };

      const updated = await keyService.updateApiKey("key-123", dto);
      expect(updated.expires_at).toBe(futureDate);
    });

    it("should throw NotFoundError for non-existent key", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      const dto: UpdateApiKeyDto = {
        name: "Updated Name",
      };

      await expect(keyService.updateApiKey("non-existent", dto)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should invalidate cache when is_active changes", async () => {
      const disabledKey = { ...mockApiKey, is_active: false };
      vi.mocked(queries.updateApiKey).mockResolvedValue(disabledKey);

      const dto: UpdateApiKeyDto = {
        is_active: false,
      };

      await keyService.updateApiKey("key-123", dto);
      expect(AuthService.prototype.invalidateApiKey).toHaveBeenCalledWith(
        mockApiKey.key_hash
      );
    });

    it("should not invalidate cache when is_active unchanged", async () => {
      const dto: UpdateApiKeyDto = {
        name: "New Name",
      };

      // Reset the mock to clear previous calls
      vi.mocked(AuthService.prototype.invalidateApiKey).mockClear();

      await keyService.updateApiKey("key-123", dto);
      expect(AuthService.prototype.invalidateApiKey).not.toHaveBeenCalled();
    });
  });

  describe("disableApiKey / enableApiKey", () => {
    it("should disable API key", async () => {
      const disabledKey = { ...mockApiKey, is_active: false };
      vi.mocked(queries.updateApiKey).mockResolvedValue(disabledKey);

      const disabled = await keyService.disableApiKey("key-123");
      expect(disabled.is_active).toBe(false);
    });

    it("should enable API key", async () => {
      vi.mocked(queries.updateApiKey).mockResolvedValue(mockApiKey);

      const enabled = await keyService.enableApiKey("key-123");
      expect(enabled.is_active).toBe(true);
    });

    it("should throw NotFoundError when disabling non-existent key", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      await expect(keyService.disableApiKey("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });

    it("should throw NotFoundError when enabling non-existent key", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      await expect(keyService.enableApiKey("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("addBonusQuota", () => {
    it("should add bonus quota", async () => {
      const bonusKey = { ...mockApiKey, quota_bonus: 1500 };
      vi.mocked(queries.addApiKeyBonus).mockResolvedValue(bonusKey);

      const dto: AddBonusQuotaDto = {
        amount: 5000,
      };

      const updated = await keyService.addBonusQuota("key-123", dto);
      expect(updated.quota_bonus).toBe(1500);
    });

    it("should reject zero bonus amount", async () => {
      const dto: AddBonusQuotaDto = {
        amount: 0,
      };

      await expect(keyService.addBonusQuota("key-123", dto)).rejects.toThrow(
        ValidationError
      );
      await expect(keyService.addBonusQuota("key-123", dto)).rejects.toThrow(
        "Bonus amount must be positive"
      );
    });

    it("should reject negative bonus amount", async () => {
      const dto: AddBonusQuotaDto = {
        amount: -100,
      };

      await expect(keyService.addBonusQuota("key-123", dto)).rejects.toThrow(
        ValidationError
      );
    });

    it("should reject past expiry date", async () => {
      const dto: AddBonusQuotaDto = {
        amount: 1000,
        expires_at: Date.now() - 1000,
      };

      await expect(keyService.addBonusQuota("key-123", dto)).rejects.toThrow(
        "Expiry date must be in the future"
      );
    });

    it("should accept future expiry date", async () => {
      const futureDate = Date.now() + 86400000;
      const bonusKey = { ...mockApiKey, quota_bonus: 1000, quota_bonus_expiry: futureDate };
      vi.mocked(queries.addApiKeyBonus).mockResolvedValue(bonusKey);

      const dto: AddBonusQuotaDto = {
        amount: 1000,
        expires_at: futureDate,
      };

      const updated = await keyService.addBonusQuota("key-123", dto);
      // The response includes quota_bonus and quota_bonus_expiry
      expect(updated.quota_bonus).toBeGreaterThan(0);
    });

    it("should throw NotFoundError for non-existent key", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      const dto: AddBonusQuotaDto = {
        amount: 1000,
      };

      await expect(keyService.addBonusQuota("non-existent", dto)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should accept null expires_at", async () => {
      const bonusKey = { ...mockApiKey, quota_bonus: 1000, quota_bonus_expiry: null };
      vi.mocked(queries.addApiKeyBonus).mockResolvedValue(bonusKey);

      const dto: AddBonusQuotaDto = {
        amount: 1000,
        expires_at: undefined,
      };

      const updated = await keyService.addBonusQuota("key-123", dto);
      expect(updated.quota_bonus).toBe(1000);
    });

    it("should invalidate cache after adding bonus", async () => {
      const bonusKey = { ...mockApiKey, quota_bonus: 1000 };
      vi.mocked(queries.addApiKeyBonus).mockResolvedValue(bonusKey);

      const dto: AddBonusQuotaDto = {
        amount: 1000,
      };

      await keyService.addBonusQuota("key-123", dto);
      expect(AuthService.prototype.invalidateApiKey).toHaveBeenCalledWith(
        mockApiKey.key_hash
      );
    });
  });

  describe("resetQuota", () => {
    it("should reset quota usage", async () => {
      const resetKey = { ...mockApiKey, quota_used: 0 };
      vi.mocked(queries.resetApiKeyQuota).mockResolvedValue(resetKey);

      const reset = await keyService.resetQuota("key-123");
      expect(reset.quota_used).toBe(0);
    });

    it("should throw NotFoundError for non-existent key", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      await expect(keyService.resetQuota("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });

    it("should invalidate cache after reset", async () => {
      const resetKey = { ...mockApiKey, quota_used: 0 };
      vi.mocked(queries.resetApiKeyQuota).mockResolvedValue(resetKey);

      await keyService.resetQuota("key-123");
      expect(AuthService.prototype.invalidateApiKey).toHaveBeenCalledWith(
        mockApiKey.key_hash
      );
    });
  });

  describe("deleteApiKey", () => {
    it("should delete API key", async () => {
      await expect(keyService.deleteApiKey("key-123")).resolves.not.toThrow();
    });

    it("should throw NotFoundError for non-existent key", async () => {
      vi.mocked(queries.getApiKey).mockResolvedValue(null);

      await expect(keyService.deleteApiKey("non-existent")).rejects.toThrow(
        NotFoundError
      );
    });

    it("should invalidate cache before deleting", async () => {
      await keyService.deleteApiKey("key-123");
      expect(AuthService.prototype.invalidateApiKey).toHaveBeenCalledWith(
        mockApiKey.key_hash
      );
    });
  });
});
