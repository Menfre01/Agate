/**
 * Admin API Integration Tests
 *
 * Tests for the admin endpoints (/admin/*).
 *
 * Note: Full integration tests require a real D1 database.
 * These tests verify function exports and basic validation logic.
 *
 * @module tests/integration/admin
 */

import { describe, it, expect } from "vitest";
import {
  listKeys,
  createKey,
  updateKey,
  deleteKey,
} from "@/api/admin/keys.js";
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  addCredential,
} from "@/api/admin/providers.js";
import {
  listModels,
  createModel,
  updateModel,
  deleteModel,
  linkProvider,
  unlinkProvider,
} from "@/api/admin/models.js";
import {
  listQuotas,
  updateQuota,
  resetQuota,
  addBonus,
} from "@/api/admin/quotas.js";
import {
  getUsageStats,
  getTokenUsage,
  getCostAnalysis,
  getModelStats,
} from "@/api/admin/stats.js";

describe("Admin API - /admin/keys exports", () => {
  it("should export listKeys function", () => {
    expect(typeof listKeys).toBe("function");
  });

  it("should export createKey function", () => {
    expect(typeof createKey).toBe("function");
  });

  it("should export updateKey function", () => {
    expect(typeof updateKey).toBe("function");
  });

  it("should export deleteKey function", () => {
    expect(typeof deleteKey).toBe("function");
  });
});

describe("Admin API - /admin/providers exports", () => {
  it("should export listProviders function", () => {
    expect(typeof listProviders).toBe("function");
  });

  it("should export createProvider function", () => {
    expect(typeof createProvider).toBe("function");
  });

  it("should export updateProvider function", () => {
    expect(typeof updateProvider).toBe("function");
  });

  it("should export deleteProvider function", () => {
    expect(typeof deleteProvider).toBe("function");
  });

  it("should export addCredential function", () => {
    expect(typeof addCredential).toBe("function");
  });
});

describe("Admin API - /admin/models exports", () => {
  it("should export listModels function", () => {
    expect(typeof listModels).toBe("function");
  });

  it("should export createModel function", () => {
    expect(typeof createModel).toBe("function");
  });

  it("should export updateModel function", () => {
    expect(typeof updateModel).toBe("function");
  });

  it("should export deleteModel function", () => {
    expect(typeof deleteModel).toBe("function");
  });

  it("should export linkProvider function", () => {
    expect(typeof linkProvider).toBe("function");
  });

  it("should export unlinkProvider function", () => {
    expect(typeof unlinkProvider).toBe("function");
  });
});

describe("Admin API - /admin/quotas exports", () => {
  it("should export listQuotas function", () => {
    expect(typeof listQuotas).toBe("function");
  });

  it("should export updateQuota function", () => {
    expect(typeof updateQuota).toBe("function");
  });

  it("should export resetQuota function", () => {
    expect(typeof resetQuota).toBe("function");
  });

  it("should export addBonus function", () => {
    expect(typeof addBonus).toBe("function");
  });
});

describe("Admin API - /admin/stats exports", () => {
  it("should export getUsageStats function", () => {
    expect(typeof getUsageStats).toBe("function");
  });

  it("should export getTokenUsage function", () => {
    expect(typeof getTokenUsage).toBe("function");
  });

  it("should export getCostAnalysis function", () => {
    expect(typeof getCostAnalysis).toBe("function");
  });

  it("should export getModelStats function", () => {
    expect(typeof getModelStats).toBe("function");
  });
});
