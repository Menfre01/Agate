#!/usr/bin/env tsx
/**
 * Create Test API Key Script
 *
 * Generates a real API key using KeyService and outputs it.
 * Usage: npx tsx scripts/create-test-key.ts
 */

import { KeyService } from "../src/services/key.service.js";

// Mock environment for local development
const mockEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({
        all: async () => [],
        first: async () => undefined,
        run: async () => ({ meta: { changes: 0 } }),
      }),
    }),
    batch: async () => [],
  },
  KV_CACHE: {
    get: async () => null,
    put: async () => {},
  },
  ENVIRONMENT: "development",
} as any;

async function createTestKey() {
  const keyService = new KeyService(mockEnv);

  const keyData = {
    user_id: "u_admin",
    company_id: "co_demo_company",
    department_id: "dept_engineering",
    name: "Test Admin Key",
    quota_daily: 0,
    is_unlimited: true,
  };

  const result = await keyService.createApiKey(keyData);

  console.log("\n==========================================");
  console.log("Test API Key Created Successfully!");
  console.log("==========================================\n");
  console.log("API Key: " + result.key);
  console.log("\nKey ID: " + result.response.id);
  console.log("Prefix: " + result.response.key_prefix);
  console.log("\nUse this key to test the gateway:");
  console.log(`  curl --noproxy '*' -H "x-api-key: ${result.key}" http://localhost:8787/v1/models`);
  console.log("\n==========================================\n");

  // Output for easy copying
  console.log("API_KEY=" + result.key);
}

createTestKey().catch(console.error);
