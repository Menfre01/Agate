/**
 * Integration Test Helpers
 *
 * Provides utilities for setting up and running integration tests.
 *
 * @module tests/integration/helpers
 */

import type { Env } from "@/types/index.js";
import { beforeAll, beforeEach, afterEach } from "vitest";

/**
 * Creates a mock environment for testing.
 */
export function createMockEnv(): Env {
  return {
    DB: null as unknown as D1Database,
    KV_CACHE: null as unknown as KVNamespace,
    ENVIRONMENT: "test",
    ANTHROPIC_API_KEY: "test-key",
    ADMIN_API_KEYS: ["admin-key-1", "admin-key-2"],
  };
}

/**
 * Creates a mock D1 database with basic schema.
 */
export async function createTestDb(): Promise<D1Database> {
  // For now, return a mock - in a real scenario, we'd use a real D1 instance
  return null as unknown as D1Database;
}

/**
 * Integration test setup options.
 */
export interface IntegrationTestSetup {
  /** Whether to initialize the database schema */
  initSchema?: boolean;
  /** Whether to seed test data */
  seedData?: boolean;
}

/**
 * Sets up integration test environment.
 */
export async function setupIntegrationTest(
  options: IntegrationTestSetup = {}
): Promise<Env> {
  const env = createMockEnv();

  if (options.initSchema) {
    // Initialize database schema
    await initTestSchema(env.DB);
  }

  if (options.seedData) {
    // Seed test data
    await seedTestData(env.DB);
  }

  return env;
}

/**
 * Initializes test database schema.
 */
async function initTestSchema(db: D1Database): Promise<void> {
  // Schema initialization would go here
  // For now, this is a placeholder
}

/**
 * Seeds test data.
 */
async function seedTestData(db: D1Database): Promise<void> {
  // Test data seeding would go here
  // For now, this is a placeholder
}

/**
 * Cleans up test data after tests.
 */
export async function cleanupIntegrationTest(env: Env): Promise<void> {
  // Tables to clean in order (respecting foreign key constraints)
  const tables = [
    "usage_logs",
    "quota_changes",
    "department_models",
    "api_keys",
    "models",
    "provider_credentials",
    "providers",
    "users",
    "departments",
    "companies",
  ];

  // Delete test data (identified by patterns)
  for (const table of tables) {
    try {
      // Delete rows with test-like patterns
      await env.DB
        .prepare(`
          DELETE FROM ${table}
          WHERE id REGEXP '.*[0-9]{13,}$'
             OR name LIKE 'Test %'
             OR name LIKE 'test-%'
        `)
        .run();

      // For users table, also clean by email pattern
      if (table === "users") {
        await env.DB
          .prepare(`
            DELETE FROM ${table}
            WHERE email LIKE '%@example.com'
               OR email LIKE 'test-%@%'
               OR email LIKE '%-test-%'
          `)
          .run();
      }
    } catch (error) {
      // Ignore errors (table might not exist in test environment)
    }
  }
}
