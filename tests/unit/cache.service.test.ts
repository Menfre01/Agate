/**
 * Unit tests for CacheService.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CacheService, CACHE_TTL } from "@agate/shared/services/cache.service.js";
import type { ApiKey } from "@/types/index.js";

/**
 * Mock KV namespace.
 */
// @ts-ignore - Mock doesn't need to implement full KVNamespace interface
class MockKVNamespace {
  private store = new Map<string, { value: string; expiration?: number }>();

  async get(key: string): Promise<string | null>;
  async get(key: string, type: "text"): Promise<string | null>;
  async get(key: string, type: "json"): Promise<unknown>;
  async get(key: string, type: "stream"): Promise<ReadableStream | null>;
  async get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  async get(
    key: string,
    type?: string
  ): Promise<string | null | ReadableStream | ArrayBuffer | unknown> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiration && Date.now() > entry.expiration) {
      this.store.delete(key);
      return null;
    }

    if (type === "json") {
      try {
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    }

    if (type === "arrayBuffer") {
      return new TextEncoder().encode(entry.value).buffer;
    }

    return entry.value;
  }

  async put(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: KVNamespacePutOptions
  ): Promise<void> {
    let stringValue: string;

    if (typeof value === "string") {
      stringValue = value;
    } else if (value instanceof ReadableStream) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk as Uint8Array);
      }
      const combined = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      stringValue = new TextDecoder().decode(combined);
    } else {
      stringValue = new TextDecoder().decode(value);
    }

    const expiration = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;

    this.store.set(key, { value: stringValue, expiration });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<KVNamespaceListResult<string>> {
    throw new Error("Not implemented in mock");
  }

  get withMetadata(): any {
    throw new Error("Not implemented in mock");
  }
}

describe("CacheService", () => {
  let cache: CacheService;
  let mockKv: MockKVNamespace;

  beforeEach(() => {
    mockKv = new MockKVNamespace();
    cache = new CacheService(mockKv as unknown as KVNamespace);
  });

  describe("setApiKey / getApiKey", () => {
    const mockApiKey: ApiKey = {
      id: "key-123",
      key_hash: "hash-abc",
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

    const mockUser = { id: "user-123", email: "test@example.com", name: "Test User", role: "admin" };
    const mockCompany = { id: "company-123", name: "Test Company" };
    const mockDepartment = { id: "dept-123", name: "Test Department" };

    it("should cache and retrieve API key data", async () => {
      const keyHash = "test-hash-123";

      await cache.setApiKey(keyHash, mockApiKey, mockUser, mockCompany, mockDepartment);
      const cached = await cache.getApiKey(keyHash);

      expect(cached).toBeDefined();
      expect(cached?.id).toBe(mockApiKey.id);
      expect(cached?.user_id).toBe(mockApiKey.user_id);
      expect(cached?.company_id).toBe(mockApiKey.company_id);
      expect(cached?.is_active).toBe(mockApiKey.is_active);
    });

    it("should return null for non-existent key", async () => {
      const cached = await cache.getApiKey("non-existent");
      expect(cached).toBeNull();
    });

    it("should store with default TTL", async () => {
      const keyHash = "test-hash-456";

      await cache.setApiKey(keyHash, mockApiKey, mockUser, mockCompany, mockDepartment);
      const cached = await cache.getApiKey(keyHash);

      expect(cached).toBeDefined();
    });

    it("should store with custom TTL", async () => {
      const keyHash = "test-hash-789";

      await cache.setApiKey(keyHash, mockApiKey, mockUser, mockCompany, mockDepartment, CACHE_TTL.SHORT);
      const cached = await cache.getApiKey(keyHash);

      expect(cached).toBeDefined();
    });

    it("should handle null department_id", async () => {
      const apiKeyNoDept: ApiKey = {
        ...mockApiKey,
        department_id: null,
      };

      await cache.setApiKey("hash-no-dept", apiKeyNoDept, mockUser, mockCompany, null);
      const cached = await cache.getApiKey("hash-no-dept");

      expect(cached?.department_id).toBeNull();
    });

    it("should handle all nullable fields", async () => {
      const apiKeyNulls: ApiKey = {
        ...mockApiKey,
        department_id: null,
        name: null,
        last_reset_at: null,
        expires_at: null,
        quota_bonus_expiry: null,
      };

      await cache.setApiKey("hash-nulls", apiKeyNulls, mockUser, mockCompany, null);
      const cached = await cache.getApiKey("hash-nulls");

      expect(cached?.department_id).toBeNull();
      expect(cached?.name).toBeNull();
      expect(cached?.last_reset_at).toBeNull();
      expect(cached?.expires_at).toBeNull();
      expect(cached?.quota_bonus_expiry).toBeNull();
    });
  });

  describe("deleteApiKey", () => {
    it("should delete cached API key", async () => {
      const mockApiKey: ApiKey = {
        id: "key-delete",
        key_hash: "hash-delete",
        key_prefix: "sk-del...",
        user_id: "user-123",
        company_id: "company-123",
        department_id: null,
        name: "Delete Test",
        quota_daily: 1000,
        quota_used: 0,
        quota_bonus: 0,
        quota_bonus_expiry: null,
        is_unlimited: false,
        is_active: true,
        last_reset_at: null,
        last_used_at: Date.now(),
        expires_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      const mockUser = { id: "user-123", email: "test@example.com", name: "Test User", role: "admin" };
      const mockCompany = { id: "company-123", name: "Test Company" };

      const keyHash = "hash-to-delete";

      await cache.setApiKey(keyHash, mockApiKey, mockUser, mockCompany, null);
      expect(await cache.getApiKey(keyHash)).toBeDefined();

      await cache.deleteApiKey(keyHash);
      expect(await cache.getApiKey(keyHash)).toBeNull();
    });

    it("should handle deleting non-existent key", async () => {
      await expect(cache.deleteApiKey("non-existent")).resolves.not.toThrow();
    });
  });

  describe("set / get (generic)", () => {
    it("should cache and retrieve generic data", async () => {
      interface TestData {
        name: string;
        value: number;
      }

      const data: TestData = { name: "test", value: 42 };

      await cache.set("test", "key", data, CACHE_TTL.SHORT);
      const retrieved = await cache.get<TestData>("test", "key");

      expect(retrieved).toEqual(data);
    });

    it("should return null for non-existent generic key", async () => {
      const result = await cache.get("test", "non-existent");
      expect(result).toBeNull();
    });

    it("should cache complex objects", async () => {
      const complex = {
        nested: {
          array: [1, 2, 3],
          object: { a: "b" },
        },
        null: null,
      };

      await cache.set("complex", "data", complex, CACHE_TTL.LONG);
      const retrieved = await cache.get<typeof complex>("complex", "data");

      expect(retrieved).toEqual(complex);
    });
  });

  describe("delete (generic)", () => {
    it("should delete generic cached data", async () => {
      const data = { test: "value" };

      await cache.set("delete", "test", data, CACHE_TTL.SHORT);
      expect(await cache.get("delete", "test")).toBeDefined();

      await cache.delete("delete", "test");
      expect(await cache.get("delete", "test")).toBeNull();
    });
  });
});
