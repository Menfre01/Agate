/**
 * Unit tests for HealthCheckService
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HealthCheckService } from "../../workers/health/src/services/health-check.service";

// Mock queries module
vi.mock("@agate/shared/db/queries.js", () => ({
  getAllActiveCredentials: vi.fn(),
  updateCredentialHealth: vi.fn(),
  createUsageLog: vi.fn(),
  getSystemUserQuota: vi.fn(),
  getProvider: vi.fn(),
}));

// Mock crypto.subtle methods
const mockDigest = vi.fn().mockResolvedValue(new Uint8Array(32).fill(0));
const mockImportKey = vi.fn().mockResolvedValue({
  type: "secret",
  algorithm: { name: "AES-GCM" },
});
const mockDecrypt = vi.fn().mockResolvedValue(
  new TextEncoder().encode("test-api-key")
);

// Store original crypto
const originalSubtle = crypto.subtle;

describe("HealthCheckService", () => {
  let mockEnv: any;
  let mockDb: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock crypto.subtle methods
    crypto.subtle.digest = mockDigest;
    crypto.subtle.importKey = mockImportKey;
    crypto.subtle.decrypt = mockDecrypt;

    // Mock database
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    };

    // Mock environment
    mockEnv = {
      DB: mockDb,
      ENCRYPTION_KEY: "test-encryption-key",
      SYSTEM_USER_ID: "sys-health-user",
      SYSTEM_COMPANY_ID: "sys-health",
      KV_CACHE: {},
    };

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Ensure no real database operations were performed
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  afterAll(() => {
    // Note: crypto.subtle is read-only in newer Node versions
    // Mocks are reset between tests by vi.clearAllMocks()
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      const service = new HealthCheckService(mockEnv);
      expect(service).toBeDefined();
    });

    it("should use environment variables when provided", () => {
      const envWithCustoms = {
        ...mockEnv,
        HEALTH_CHECK_MODEL: "claude-3-sonnet",
        HEALTH_CHECK_MAX_TOKENS: 5,
        HEALTH_CHECK_TIMEOUT: 5000,
      };
      const service = new HealthCheckService(envWithCustoms);
      expect(service).toBeDefined();
    });
  });

  describe("checkSystemUserQuota", () => {
    it("should allow proceeding when quota is available", async () => {
      const { getSystemUserQuota } = await import("@agate/shared/db/queries.js");
      (getSystemUserQuota as any).mockResolvedValue({
        quota_daily: 10000,
        quota_used: 1000,
        quota_remaining: 9000,
      });

      const service = new HealthCheckService(mockEnv);
      // Access private method via type assertion
      const result = await (service as any).checkSystemUserQuota();

      expect(result.canProceed).toBe(true);
      expect(result.remaining).toBe(9000);
    });

    it("should deny proceeding when quota is exhausted", async () => {
      const { getSystemUserQuota } = await import("@agate/shared/db/queries.js");
      (getSystemUserQuota as any).mockResolvedValue({
        quota_daily: 10000,
        quota_used: 10000,
        quota_remaining: 0,
      });

      const service = new HealthCheckService(mockEnv);
      const result = await (service as any).checkSystemUserQuota();

      expect(result.canProceed).toBe(false);
      expect(result.reason).toContain("exhausted");
    });

    it("should warn when approaching quota limit", async () => {
      const { getSystemUserQuota } = await import("@agate/shared/db/queries.js");
      (getSystemUserQuota as any).mockResolvedValue({
        quota_daily: 10000,
        quota_used: 8500,
        quota_remaining: 1500,
      });

      const service = new HealthCheckService(mockEnv);
      const result = await (service as any).checkSystemUserQuota();

      expect(result.canProceed).toBe(true);
      expect(result.reason).toContain("85%");
    });
  });

  describe("checkCredential", () => {
    it("should successfully check a healthy credential", async () => {
      const { createUsageLog } = await import("@agate/shared/db/queries.js");
      (createUsageLog as any).mockResolvedValue(undefined);

      const mockCredential = {
        id: "cred-123",
        provider_id: "provider-123",
        credential_name: "Test Credential",
        api_key_encrypted: "encrypted-key",
        base_url: null,
        provider_name: "anthropic",
        provider_base_url: "https://api.anthropic.com",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          usage: { input_tokens: 9, output_tokens: 1 },
        }),
      });

      const service = new HealthCheckService(mockEnv);
      const result = await service.checkCredential(mockCredential, "api-key-123");

      expect(result.success).toBe(true);
      expect(result.inputTokens).toBe(9);
      expect(result.outputTokens).toBe(1);
      expect(result.credentialId).toBe("cred-123");
    });

    it("should handle failed health check", async () => {
      const { createUsageLog } = await import("@agate/shared/db/queries.js");
      (createUsageLog as any).mockResolvedValue(undefined);

      const mockCredential = {
        id: "cred-123",
        provider_id: "provider-123",
        credential_name: "Test Credential",
        api_key_encrypted: "encrypted-key",
        base_url: null,
        provider_name: "anthropic",
        provider_base_url: "https://api.anthropic.com",
      };

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const service = new HealthCheckService(mockEnv);
      const result = await service.checkCredential(mockCredential, "api-key-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
      expect(result.statusCode).toBe(401);
    });

    it("should handle network errors", async () => {
      const { createUsageLog } = await import("@agate/shared/db/queries.js");
      (createUsageLog as any).mockResolvedValue(undefined);

      const mockCredential = {
        id: "cred-123",
        provider_id: "provider-123",
        credential_name: "Test Credential",
        api_key_encrypted: "encrypted-key",
        base_url: null,
        provider_name: "anthropic",
        provider_base_url: "https://api.anthropic.com",
      };

      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      const service = new HealthCheckService(mockEnv);
      const result = await service.checkCredential(mockCredential, "api-key-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("should use credential-level base_url when set", async () => {
      const { createUsageLog } = await import("@agate/shared/db/queries.js");
      (createUsageLog as any).mockResolvedValue(undefined);

      const mockCredential = {
        id: "cred-123",
        provider_id: "provider-123",
        credential_name: "Test Credential",
        api_key_encrypted: "encrypted-key",
        base_url: "https://custom.endpoint.com",
        provider_name: "anthropic",
        provider_base_url: "https://api.anthropic.com",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          usage: { input_tokens: 9, output_tokens: 1 },
        }),
      });

      const service = new HealthCheckService(mockEnv);
      await service.checkCredential(mockCredential, "api-key-123");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://custom.endpoint.com/v1/messages",
        expect.any(Object)
      );
    });
  });

  describe("decryptApiKey", () => {
    it("should decrypt an encrypted API key", async () => {
      const service = new HealthCheckService(mockEnv);
      const decrypted = await (service as any).decryptApiKey("valid-hex-string");

      expect(decrypted).toBe("test-api-key");
    });
  });
});
