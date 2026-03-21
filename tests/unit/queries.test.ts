/**
 * Unit Tests for Database Query Layer
 *
 * Tests the Queries class with mocked D1Database
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";

// Mock D1Database
const mockDb = {
  prepare: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
  dump: vi.fn(),
} as unknown as D1Database;

// Import after mock is set up
import { Queries, type Company, type ApiKey, type CreateCompanyDto } from "@/db/queries";

describe("Queries - Database Layer", () => {
  let queries: Queries;

  beforeEach(() => {
    vi.clearAllMocks();
    queries = new Queries(mockDb);
  });

  // ============================================
  // Helper Functions
  // ============================================

  function mockFirst<T>(data: T | null) {
    const mockBindedStatement = {
      first: vi.fn().mockResolvedValue(data),
      all: vi.fn().mockResolvedValue({ results: data ? [data] : [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const mockStatement = {
      bind: vi.fn().mockReturnValue(mockBindedStatement),
      all: vi.fn().mockResolvedValue({ results: data ? [data] : [] }),
      first: vi.fn().mockResolvedValue(data),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    vi.mocked(mockDb.prepare).mockReturnValue(mockStatement as any);
    return mockStatement;
  }

  function mockAll<T>(data: T[]) {
    const mockBindedStatement = {
      first: vi.fn().mockResolvedValue(data[0] || null),
      all: vi.fn().mockResolvedValue({ results: data, success: true }),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const mockStatement = {
      bind: vi.fn().mockReturnValue(mockBindedStatement),
      all: vi.fn().mockResolvedValue({ results: data, success: true }),
      first: vi.fn().mockResolvedValue(data[0] || null),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    vi.mocked(mockDb.prepare).mockReturnValue(mockStatement as any);
    return mockStatement;
  }

  function mockRun(success: boolean = true, error?: string) {
    const mockBindedStatement = {
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
      run: vi.fn().mockResolvedValue({ success, error }),
    };
    const mockStatement = {
      bind: vi.fn().mockReturnValue(mockBindedStatement),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success, error }),
    };
    vi.mocked(mockDb.prepare).mockReturnValue(mockStatement as any);
    return mockStatement;
  }

  // ============================================
  // Company CRUD Tests
  // ============================================

  describe("Company CRUD", () => {
    const mockCompany: Company = {
      id: "comp_123",
      name: "Test Company",
      quota_pool: 1000000,
      quota_used: 50000,
      quota_daily: 10000,
      daily_used: 1000,
      last_reset_at: 1234567890,
      created_at: 1234567890,
      updated_at: 1234567890,
    };

    it("should get a company by ID", async () => {
      mockFirst(mockCompany);

      const result = await queries.getCompany("comp_123");

      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM companies WHERE id = ?1");
      expect(result).toEqual(mockCompany);
    });

    it("should return null when company not found by ID", async () => {
      mockFirst(null);

      const result = await queries.getCompany("nonexistent");

      expect(result).toBeNull();
    });

    it("should get a company by name", async () => {
      mockFirst(mockCompany);

      const result = await queries.getCompanyByName("Test Company");

      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM companies WHERE name = ?1");
      expect(result).toEqual(mockCompany);
    });

    it("should list all companies", async () => {
      mockAll([mockCompany]);

      const result = await queries.listCompanies();

      expect(mockDb.prepare).toHaveBeenCalledWith(`
        SELECT
          c.*,
          (SELECT COUNT(*) FROM users WHERE users.company_id = c.id AND users.is_active = TRUE) as user_count,
          (SELECT COUNT(*) FROM departments WHERE departments.company_id = c.id) as department_count
        FROM companies c
        ORDER BY c.created_at DESC
      `);
      expect(result).toEqual([mockCompany]);
    });

    it("should create a new company", async () => {
      // Mock the insert operation
      mockRun(true);

      // Mock the select operation for retrieval
      mockFirst(mockCompany);

      const data: CreateCompanyDto = {
        id: "comp_new",
        name: "New Company",
        quota_pool: 500000,
        quota_daily: 5000,
      };

      const result = await queries.createCompany(data);

      expect(result).toEqual(mockCompany);
    });

    it("should update a company", async () => {
      mockFirst(mockCompany);

      const updatedCompany = { ...mockCompany, name: "Updated Company" };
      mockFirst(updatedCompany);

      const result = await queries.updateCompany("comp_123", { name: "Updated Company" });

      expect(result).toEqual(updatedCompany);
    });
  });

  // ============================================
  // API Key Tests
  // ============================================

  describe("API Key Operations", () => {
    const mockApiKey: ApiKey = {
      id: "key_123",
      key_hash: "abc123hash",
      key_prefix: "sk-abc123...",
      user_id: "user_123",
      company_id: "comp_123",
      department_id: "dept_123",
      name: "Test Key",
      quota_daily: 1000,
      quota_used: 100,
      quota_bonus: 0,
      quota_bonus_used: 0,
      quota_bonus_expiry: null,
      is_unlimited: false,
      is_active: true,
      last_reset_at: 1234567890,
      last_used_at: 1234567890,
      expires_at: null,
      created_at: 1234567890,
      updated_at: 1234567890,
    };

    it("should get API key by hash", async () => {
      mockFirst(mockApiKey);

      const result = await queries.getApiKeyByKeyHash("abc123hash");

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("api_keys"));
      expect(result).toEqual(mockApiKey);
    });

    it("should return null when API key hash not found", async () => {
      mockFirst(null);

      const result = await queries.getApiKeyByKeyHash("nonexistent");

      expect(result).toBeNull();
    });

    it("should update API key last used timestamp", async () => {
      mockRun(true);

      await queries.updateApiKeyLastUsed("key_123");

      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  // ============================================
  // Provider Tests
  // ============================================

  describe("Provider Operations", () => {
    const mockProvider = {
      id: "prov_123",
      name: "anthropic",
      display_name: "Anthropic",
      base_url: "https://api.anthropic.com",
      api_version: "2023-06-01",
      is_active: true,
      created_at: 1234567890,
      updated_at: 1234567890,
    };

    it("should get provider by name", async () => {
      mockFirst(mockProvider);

      const result = await queries.getProviderByName("anthropic");

      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM providers WHERE name = ?1");
      expect(result).toEqual(mockProvider);
    });

    it("should list active providers", async () => {
      mockAll([mockProvider]);

      const result = await queries.listActiveProviders();

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("is_active = 1"));
      expect(result).toEqual([mockProvider]);
    });
  });

  // ============================================
  // Usage & Quota Tests
  // ============================================

  describe("Usage & Quota Operations", () => {
    it("should create usage log", async () => {
      mockRun(true);

      const mockLog = {
        id: "log_123",
        api_key_id: "key_123",
        user_id: "user_123",
        company_id: "comp_123",
        department_id: null,
        provider_id: "prov_123",
        model_id: "model_123",
        model_name: "claude-3-sonnet",
        endpoint: "/v1/messages",
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        status: "success",
        request_id: "req_123",
        response_time_ms: 1234,
      };

      mockFirst(mockLog);

      await queries.createUsageLog(mockLog);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO usage_logs"));
    });

    it("should record quota change", async () => {
      mockRun(true);

      await queries.recordQuotaChange({
        id: "qc_123",
        entity_type: "api_key",
        entity_id: "key_123",
        change_type: "add",
        change_amount: 1000,
        previous_quota: 5000,
        new_quota: 6000,
        reason: "Bonus added",
        created_by: "admin_123",
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO quota_changes"));
    });
  });

  // ============================================
  // Model Operations Tests
  // ============================================

  describe("Model Operations", () => {
    const mockModel = {
      id: "model_123",
      model_id: "claude-3-sonnet",
      display_name: "Claude 3 Sonnet",
      context_window: 200000,
      max_tokens: 4096,
      is_active: true,
      created_at: 1234567890,
      updated_at: 1234567890,
    };

    it("should get model by model_id", async () => {
      mockFirst(mockModel);

      const result = await queries.getModelByModelId("claude-3-sonnet");

      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM models WHERE model_id = ?1");
      expect(result).toEqual(mockModel);
    });

    it("should list active models", async () => {
      mockAll([mockModel]);

      const result = await queries.listActiveModels();

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("is_active = 1"));
      expect(result).toEqual([mockModel]);
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe("Error Handling", () => {
    it("should throw error when create operation fails", async () => {
      mockRun(false, "Database constraint violation");

      await expect(
        queries.createCompany({
          id: "comp_fail",
          name: "Fail Company",
        })
      ).rejects.toThrow("Failed to create company");
    });
  });
});
