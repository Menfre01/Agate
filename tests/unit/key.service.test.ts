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

    it("should reject negative bonus amount", async () => {
      const dto: AddBonusQuotaDto = {
        amount: -100,
      };

      await expect(keyService.addBonusQuota("key-123", dto)).rejects.toThrow(
        ValidationError
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
  });

  describe("deleteApiKey", () => {
    it("should delete API key", async () => {
      await expect(keyService.deleteApiKey("key-123")).resolves.not.toThrow();
    });
  });
});
