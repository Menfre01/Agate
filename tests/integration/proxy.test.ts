/**
 * Proxy API Integration Tests
 *
 * Tests for the proxy endpoints (/v1/messages, /v1/models).
 *
 * Note: Full integration tests require a real D1 database and API keys.
 * These tests verify function exports.
 *
 * @module tests/integration/proxy
 */

import { describe, it, expect } from "vitest";
import { handleMessages } from "@/api/proxy/anthropic.js";
import { handleModels } from "@/api/proxy/models.js";

describe("Proxy API - Handler exports", () => {
  it("should export handleMessages function", () => {
    expect(typeof handleMessages).toBe("function");
  });

  it("should export handleModels function", () => {
    expect(typeof handleModels).toBe("function");
  });
});
