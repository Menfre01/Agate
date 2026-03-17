/**
 * Global Test Setup
 *
 * Configures test-wide behaviors including cleanup hooks.
 *
 * @module tests/setup
 */

import { afterEach, afterAll } from "vitest";

/**
 * Flag to enable/disable automatic test cleanup.
 * Set via environment variable: TEST_CLEANUP=true
 */
const ENABLE_CLEANUP = process.env.TEST_CLEANUP === "true";

/**
 * Tracks whether we've already run cleanup to avoid duplicate calls.
 */
let cleanupCompleted = false;

/**
 * Global cleanup function for functional tests.
 * Called automatically after all tests complete if TEST_CLEANUP=true.
 */
async function globalCleanup() {
  if (!ENABLE_CLEANUP || cleanupCompleted) {
    return;
  }

  const adminBaseUrl = process.env.TEST_ADMIN_BASE_URL || "http://localhost:8788";
  const adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";

  try {
    console.log("\n[Test Setup] Running test data cleanup...");
    const response = await fetch(`${adminBaseUrl}/admin/test/cleanup`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[Test Setup] Cleanup completed: ${result.deletedRows} rows deleted from ${result.tables.length} tables`);
    } else {
      console.warn(`[Test Setup] Cleanup failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // Don't fail tests if cleanup doesn't work (server might not be running)
    console.warn("[Test Setup] Cleanup skipped (server may not be running):", error);
  }

  cleanupCompleted = true;
}

/**
 * Run cleanup after all tests complete.
 */
afterAll(async () => {
  await globalCleanup();
});

/**
 * Optional: Run cleanup after each test suite.
 * Uncomment to enable more frequent cleanup (slower but safer).
 */
// afterEach(async () => {
//   await globalCleanup();
// });

export {};
