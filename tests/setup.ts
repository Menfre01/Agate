/**
 * Global Test Setup
 *
 * Configures test-wide behaviors.
 *
 * @module tests/setup
 */

import { afterAll, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";

/**
 * Polyfill Web Crypto API for Node.js environment.
 * Vitest runs in Node.js, but Cloudflare Workers use Web Crypto API.
 */
beforeAll(() => {
  // Ensure globalThis.crypto is available (Node.js 20+)
  if (typeof globalThis.crypto === "undefined") {
    (globalThis as any).crypto = webcrypto;
  }
});

/**
 * Flag to enable/disable automatic test cleanup.
 * Set via environment variable: TEST_CLEANUP=true
 */
const ENABLE_CLEANUP = process.env.TEST_CLEANUP === "true";

/**
 * Global cleanup function for functional tests.
 *
 * Note: Test data cleanup should be handled by individual test files
 * using the helper functions in tests/functional/helpers/database.helper.ts
 *
 * For manual cleanup, run:
 *   npx tsx tests/cleanup.sql.ts | wrangler d1 execute ai-gateway-db --local --command=-
 */
async function globalCleanup() {
  if (!ENABLE_CLEANUP) {
    return;
  }

  console.log("\n[Test Setup] TEST_CLEANUP is enabled.");
  console.log("[Test Setup] Note: Individual tests are responsible for their own data cleanup.");
  console.log("[Test Setup] For manual cleanup, use: npx tsx tests/cleanup.sql.ts | wrangler d1 execute ai-gateway-db --local --command=-");
}

/**
 * Run cleanup after all tests complete.
 */
afterAll(async () => {
  await globalCleanup();
});

export {};
