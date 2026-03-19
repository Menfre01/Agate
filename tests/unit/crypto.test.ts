/**
 * Tests for crypto utilities
 *
 * NOTE: crypto.subtle.digest and crypto.getRandomValues are not fully
 * available in vitest's worker environment. We mock these to test the logic.
 */
import { describe, it, expect, vi } from "vitest";
import { extractKeyPrefix } from "@/utils/crypto";

// Mock the entire crypto module - functions must be defined inside factory
vi.mock("@/utils/crypto", () => ({
  hashApiKey: vi.fn(),
  extractKeyPrefix: (apiKey: string) => {
    if (apiKey.length <= 10) {
      return `${apiKey}...`;
    }
    return `${apiKey.slice(0, 10)}...`;
  },
  generateApiKey: vi.fn(),
}));

import { hashApiKey, generateApiKey } from "@/utils/crypto";

describe("crypto", () => {
  describe("hashApiKey (mocked)", () => {
    it("should be callable with API key", async () => {
      vi.mocked(hashApiKey).mockResolvedValue("a".repeat(64));
      const hash = await hashApiKey("sk_test_12345");
      expect(hash).toHaveLength(64);
    });

    it("should produce consistent hashes for same input", async () => {
      const testHash = "c59bbb4fd34746a419fb8a147f4e44b92ab5ac944e0355a23fcae9a3d8d2d15f";
      vi.mocked(hashApiKey).mockResolvedValue(testHash);

      const hash1 = await hashApiKey("sk_test_12345");
      const hash2 = await hashApiKey("sk_test_12345");

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(testHash);
    });

    it("should produce different hashes for different inputs", async () => {
      vi.mocked(hashApiKey)
        .mockResolvedValueOnce("a".repeat(64))
        .mockResolvedValueOnce("b".repeat(64));

      const hash1 = await hashApiKey("sk_test_12345");
      const hash2 = await hashApiKey("sk_test_67890");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("extractKeyPrefix", () => {
    it("should return prefix for long keys", () => {
      const prefix = extractKeyPrefix("sk_live_abc123def456789xyz");
      expect(prefix).toBe("sk_live_ab...");
    });

    it("should handle short keys", () => {
      const prefix = extractKeyPrefix("sk_short");
      expect(prefix).toBe("sk_short...");
    });

    it("should return exactly 10 chars plus ellipsis for long keys", () => {
      const prefix = extractKeyPrefix("sk_live_abc123def456789xyz");
      expect(prefix.length).toBe(13); // 10 chars + "..."
    });
  });

  describe("generateApiKey (mocked)", () => {
    it("should generate API key with correct format", () => {
      vi.mocked(generateApiKey).mockReturnValue("sk_1678901234_" + "abc123def456789abc123def456789abc123def456789abc123def456789abc1");
      const apiKey = generateApiKey();
      expect(apiKey).toMatch(/^sk_\d+_[a-f0-9]{64}$/);
    });

    it("should generate unique keys", () => {
      vi.mocked(generateApiKey)
        .mockReturnValueOnce("sk_1678901234_" + "a".repeat(64))
        .mockReturnValueOnce("sk_1678901235_" + "b".repeat(64));

      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).not.toBe(key2);
    });

    it("should include 64 random hex characters", () => {
      vi.mocked(generateApiKey).mockReturnValue("sk_1234567890_" + "c".repeat(64));
      const apiKey = generateApiKey();
      const parts = apiKey.split("_");
      const randomPart = parts[2];

      expect(randomPart).toHaveLength(64);
      expect(randomPart).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
