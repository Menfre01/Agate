/**
 * Unit tests for ProxyService.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProxyService } from "@agate/proxy/services/proxy.service.js";
import type {
  AuthContext,
  ProxyMessageRequest,
  Env,
  ApiKey,
  User,
  Company,
  Department,
  Model,
} from "@agate/shared/types/index.js";

// Mock dependencies
vi.mock("@agate/shared/db/queries.js", () => ({
  getApiKey: vi.fn(),
  getUser: vi.fn(),
  getCompany: vi.fn(),
  getDepartment: vi.fn(),
}));

vi.mock("@agate/proxy/services/quota.service.js", () => ({
  QuotaService: vi.fn(),
}));

vi.mock("@agate/proxy/services/provider.service.js", () => ({
  ProviderService: vi.fn(),
}));

vi.mock("@agate/proxy/services/model.service.js", () => ({
  ModelService: vi.fn(),
}));

vi.mock("@agate/proxy/services/usage.service.js", () => ({
  UsageService: vi.fn(),
}));

import * as queries from "@agate/shared/db/queries.js";
import { QuotaService } from "@agate/proxy/services/quota.service.js";
import { ProviderService } from "@agate/proxy/services/provider.service.js";
import { ModelService } from "@agate/proxy/services/model.service.js";
import { UsageService } from "@agate/proxy/services/usage.service.js";

describe("ProxyService", () => {
  let proxyService: ProxyService;
  let mockEnv: Env;
  let mockQuotaService: any;
  let mockProviderService: any;
  let mockModelService: any;
  let mockUsageService: any;

  const mockAuthContext: AuthContext = {
    apiKeyId: "key-123",
    userId: "user-123",
    userEmail: "test@example.com",
    userName: "Test User",
    userRole: "user",
    companyId: "company-123",
    companyName: "Test Company",
    departmentId: "dept-123",
    departmentName: "Test Department",
    quotaDaily: 10000,
    quotaUsed: 1000,
    quotaBonus: 0,
    quotaBonusExpiry: null,
    isUnlimited: false,
    isActive: true,
    expiresAt: null,
  };

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
    quota_bonus: 0,
    quota_bonus_used: 0,
    quota_bonus_expiry: null,
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
    is_unlimited: false,
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

  beforeEach(() => {
    mockEnv = {
      DB: {} as unknown as D1Database,
      CACHE: {} as KVNamespace,
      ENCRYPTION_KEY: "test-key",
    };

    // Setup query mocks
    vi.mocked(queries.getApiKey).mockResolvedValue(mockApiKey);
    vi.mocked(queries.getUser).mockResolvedValue(mockUser);
    vi.mocked(queries.getCompany).mockResolvedValue(mockCompany);
    vi.mocked(queries.getDepartment).mockResolvedValue(mockDepartment);

    // Setup service mocks
    mockQuotaService = {
      checkQuota: vi.fn().mockResolvedValue({
        allowed: true,
        remaining: {
          apiKeyDaily: 9000,
          userDaily: 9500,
          departmentDaily: 47500,
          departmentPool: 95000,
          companyDaily: 95000,
          companyPool: 950000,
        },
      }),
      deductQuota: vi.fn().mockResolvedValue({
        tokens: 1000,
        updated: {
          apiKey: { quota_used: 2000 },
          user: { quota_used: 1500 },
          department: { daily_used: 3500, quota_used: 6000 },
          company: { daily_used: 6000, quota_used: 51000 },
        },
      }),
    };

    mockModelService = {
      getByModelId: vi.fn().mockResolvedValue(mockModel),
      isModelAllowed: vi.fn().mockResolvedValue(true),
    };

    mockProviderService = {
      selectCredential: vi.fn().mockResolvedValue({
        apiKey: "sk-test-key",
        apiVersion: "2023-06-01",
        providerId: "provider-123",
        credentialId: "cred-123",
        baseUrl: "https://api.anthropic.com",
      }),
    };

    mockUsageService = {
      recordUsage: vi.fn().mockResolvedValue("log-123"),
      updateLastUsed: vi.fn().mockResolvedValue(undefined),
    };

    // Mock class constructors
    vi.mocked(QuotaService).mockImplementation(() => mockQuotaService);
    vi.mocked(ModelService).mockImplementation(() => mockModelService);
    vi.mocked(ProviderService).mockImplementation(() => mockProviderService);
    vi.mocked(UsageService).mockImplementation(() => mockUsageService);

    proxyService = new ProxyService(mockEnv);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe("forwardMessage", () => {
    const mockRequest: ProxyMessageRequest = {
      model: "claude-3-sonnet",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 100,
    };

    it("should successfully forward a valid request", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await proxyService.forwardMessage(mockAuthContext, mockRequest);

      expect(result.streaming).toBe(false);
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(20);
    });

    it("should validate model access before forwarding", async () => {
      mockModelService.isModelAllowed.mockResolvedValue(false);

      await expect(
        proxyService.forwardMessage(mockAuthContext, mockRequest)
      ).rejects.toThrow("Model not allowed");
    });

    it("should reject inactive models", async () => {
      mockModelService.getByModelId.mockResolvedValue({
        ...mockModel,
        is_active: false,
      });

      await expect(
        proxyService.forwardMessage(mockAuthContext, mockRequest)
      ).rejects.toThrow("Invalid or inactive model");
    });

    it("should reject when model not found", async () => {
      mockModelService.getByModelId.mockResolvedValue(null);

      await expect(
        proxyService.forwardMessage(mockAuthContext, mockRequest)
      ).rejects.toThrow("Invalid or inactive model");
    });

    it("should check quota before forwarding", async () => {
      mockQuotaService.checkQuota.mockResolvedValue({
        allowed: false,
        remaining: {
          apiKeyDaily: 0,
          userDaily: 9500,
          departmentDaily: 47500,
          departmentPool: 95000,
          companyDaily: 95000,
          companyPool: 950000,
        },
        failedAt: "apiKey",
      });

      await expect(
        proxyService.forwardMessage(mockAuthContext, mockRequest)
      ).rejects.toThrow("Quota exceeded");
    });

    it("should deduct quota after successful request", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await proxyService.forwardMessage(mockAuthContext, mockRequest);

      expect(mockQuotaService.deductQuota).toHaveBeenCalledWith(
        "key-123",
        "user-123",
        "dept-123",
        "company-123",
        30,
        false
      );
    });

    it("should record usage after successful request", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await proxyService.forwardMessage(mockAuthContext, mockRequest);

      expect(mockUsageService.recordUsage).toHaveBeenCalledWith({
        apiKeyId: "key-123",
        userId: "user-123",
        companyId: "company-123",
        departmentId: "dept-123",
        providerId: "provider-123",
        modelId: "model-123",
        modelName: "claude-3-sonnet",
        endpoint: "/v1/messages",
        inputTokens: 10,
        outputTokens: 20,
        status: "success",
        requestId: expect.any(String),
        responseTimeMs: expect.any(Number),
      });
    });

    it("should update last_used timestamp", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await proxyService.forwardMessage(mockAuthContext, mockRequest);

      expect(mockUsageService.updateLastUsed).toHaveBeenCalledWith("key-123");
    });

    it("should handle streaming responses", async () => {
      const mockStream = new ReadableStream();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "text/event-stream",
        }),
        body: mockStream,
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await proxyService.forwardMessage(mockAuthContext, {
        ...mockRequest,
        stream: true,
      });

      expect(result.streaming).toBe(true);
      expect(result.stream).toBe(mockStream);
    });

    it("should use model alias when sending upstream request", async () => {
      const mockModelWithAlias: Model = {
        ...mockModel,
        alias: "claude-3.5-sonnet",
      };
      mockModelService.getByModelId.mockResolvedValue(mockModelWithAlias);

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await proxyService.forwardMessage(mockAuthContext, mockRequest);

      // Verify the upstream model name was the alias
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          body: expect.stringContaining('"model":"claude-3.5-sonnet"'),
        })
      );
    });
  });

  describe("recordError", () => {
    it("should record error usage log", async () => {
      await proxyService.recordError(
        mockAuthContext,
        "model-123",
        "claude-3-sonnet",
        "provider-123",
        "rate_limit_exceeded",
        1234
      );

      expect(mockUsageService.recordUsage).toHaveBeenCalledWith({
        apiKeyId: "key-123",
        userId: "user-123",
        companyId: "company-123",
        departmentId: "dept-123",
        providerId: "provider-123",
        modelId: "model-123",
        modelName: "claude-3-sonnet",
        endpoint: "/v1/messages",
        inputTokens: 0,
        outputTokens: 0,
        status: "error",
        errorCode: "rate_limit_exceeded",
        requestId: expect.any(String),
        responseTimeMs: 1234,
      });
    });

    it("should generate request ID for error logging", async () => {
      await proxyService.recordError(
        mockAuthContext,
        "model-123",
        "claude-3-sonnet",
        "provider-123",
        "internal_error",
        5678
      );

      const recordCall = vi.mocked(mockUsageService.recordUsage);
      const callArgs = recordCall.mock.calls[0][0];

      expect(callArgs.requestId).toBeDefined();
      expect(callArgs.requestId).toMatch(/^[0-9a-f-]+$/);
    });
  });

  describe("edge cases", () => {
    const mockRequest: ProxyMessageRequest = {
      model: "claude-3-sonnet",
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 100,
    };

    it("should handle requests without department", async () => {
      const authContextNoDept: AuthContext = {
        ...mockAuthContext,
        departmentId: null,
        departmentName: null,
      };

      vi.mocked(queries.getDepartment).mockResolvedValue(null);

      mockQuotaService.checkQuota.mockResolvedValue({
        allowed: true,
        remaining: {
          apiKeyDaily: 9000,
          userDaily: 9500,
          departmentDaily: null,
          departmentPool: null,
          companyDaily: 95000,
          companyPool: 950000,
        },
      });

      mockQuotaService.deductQuota.mockResolvedValue({
        tokens: 1000,
        updated: {
          apiKey: { quota_used: 2000 },
          user: { quota_used: 1500 },
          company: { daily_used: 6000, quota_used: 51000 },
        },
      });

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(
        proxyService.forwardMessage(authContextNoDept, mockRequest)
      ).resolves.toBeDefined();
    });

    it("should handle empty response usage", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({}),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await proxyService.forwardMessage(mockAuthContext, mockRequest);

      expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    });

    it("should handle malformed response JSON", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: async () => {
          throw new Error("Invalid JSON");
        },
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await proxyService.forwardMessage(mockAuthContext, mockRequest);

      expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    });

    it("should handle requests with system message", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          usage: { input_tokens: 15, output_tokens: 25 },
        }),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const requestWithSystem: ProxyMessageRequest = {
        ...mockRequest,
        system: "You are a helpful assistant",
      };

      await expect(
        proxyService.forwardMessage(mockAuthContext, requestWithSystem)
      ).resolves.toBeDefined();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"system":"You are a helpful assistant"'),
        })
      );
    });

    it("should handle requests with all optional parameters", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          usage: { input_tokens: 20, output_tokens: 30 },
        }),
        body: new ReadableStream(),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const fullRequest: ProxyMessageRequest = {
        model: "claude-3-sonnet",
        messages: [
          { role: "user", content: "Test" },
        ],
        max_tokens: 200,
        system: "Be helpful",
        stop_sequences: ["STOP"],
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9,
        stream: false,
      };

      await expect(
        proxyService.forwardMessage(mockAuthContext, fullRequest)
      ).resolves.toBeDefined();
    });
  });
});
