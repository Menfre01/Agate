/**
 * Tests for crypto utilities
 */
import { describe, it, expect } from "vitest";
import { hashApiKey, extractKeyPrefix, generateApiKey } from "@/utils/crypto";

describe("crypto", () => {
  describe("hashApiKey", () => {
    it("should compute SHA-256 hash of API key", async () => {
      const apiKey = "sk_test_12345";
      const hash = await hashApiKey(apiKey);

      expect(hash).toBeTypeOf("string");
      expect(hash).toHaveLength(64); // SHA-256 hex string is 64 chars
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce consistent hashes for same input", async () => {
      const apiKey = "sk_test_12345";
      const hash1 = await hashApiKey(apiKey);
      const hash2 = await hashApiKey(apiKey);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", async () => {
      const hash1 = await hashApiKey("sk_test_12345");
      const hash2 = await hashApiKey("sk_test_67890");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("extractKeyPrefix", () => {
    it("should return prefix for long keys", () => {
      const apiKey = "sk_live_abc123def456789xyz";
      const prefix = extractKeyPrefix(apiKey);

      expect(prefix).toBe("sk_live_ab...");
    });

    it("should handle short keys", () => {
      const apiKey = "sk_short";
      const prefix = extractKeyPrefix(apiKey);

      expect(prefix).toBe("sk_short...");
    });

    it("should return exactly 10 chars plus ellipsis for long keys", () => {
      const apiKey = "sk_live_abc123def456789xyz";
      const prefix = extractKeyPrefix(apiKey);

      expect(prefix.length).toBe(13); // 10 chars + "..."
    });
  });

  describe("generateApiKey", () => {
    it("should generate API key with correct format", () => {
      const apiKey = generateApiKey();

      expect(apiKey).toMatch(/^sk_\d+_[a-f0-9]{64}$/);
    });

    it("should generate unique keys", () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).not.toBe(key2);
    });

    it("should include timestamp in key", () => {
      const before = Date.now();
      const apiKey = generateApiKey();
      const after = Date.now();

      const parts = apiKey.split("_");
      const timestampStr = parts[1];
      if (!timestampStr) {
        throw new Error("Invalid API key format");
      }
      const timestamp = Number.parseInt(timestampStr, 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("should include 64 random hex characters", () => {
      const apiKey = generateApiKey();
      const parts = apiKey.split("_");
      const randomPart = parts[2];

      expect(randomPart).toHaveLength(64);
      expect(randomPart).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
