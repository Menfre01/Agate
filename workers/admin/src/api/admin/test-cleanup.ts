/**
 * Test Data Cleanup API
 *
 * Admin endpoint for cleaning up test data.
 * Only works in test/development environments.
 *
 * @module api/admin/test-cleanup
 */

import type {
  Env,
  RequestContext,
} from "@agate/shared/types";
import { withResponseLogging } from "@agate/shared/middleware/logger.js";
import { ValidationError } from "@agate/shared/utils/errors/index.js";

// Tables to clean in order (respecting foreign key constraints)
const CLEANUP_ORDER = [
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
] as const;

/**
 * Cleans up test data from all tables.
 * Only works in test/development environment for safety.
 */
async function cleanupTestData(env: Env): Promise<{ tables: string[]; deletedRows: number }> {
  let totalDeleted = 0;
  const cleanedTables: string[] = [];

  // Safety check: only allow in test/dev environments
  if (env.ENVIRONMENT === "production") {
    throw new ValidationError("Test data cleanup is not allowed in production environment");
  }

  // Clean each table in order
  for (const table of CLEANUP_ORDER) {
    // Delete test data (entities created during tests)
    // We identify test data by:
    // 1. IDs containing timestamp patterns (ends with 13+ digits)
    // 2. Emails containing @example.com
    // 3. Names starting with "Test " or containing timestamp-like patterns
    let deletedCount = 0;

    // Delete by ID pattern (test data often uses Date.now() in IDs)
    const idResult = await env.DB
      .prepare(`
        DELETE FROM ${table}
        WHERE id REGEXP '.*[0-9]{13,}$'
      `)
      .run();

    if (idResult.meta?.changes) {
      deletedCount += idResult.meta.changes;
    }

    // Delete by email pattern (for users table)
    if (table === "users") {
      const emailResult = await env.DB
        .prepare(`
          DELETE FROM ${table}
        WHERE email LIKE '%@example.com'
          OR email LIKE 'test-%@%'
          OR email LIKE '%-test-%'
        `)
        .run();
      if (emailResult.meta?.changes) {
        deletedCount += emailResult.meta.changes;
      }
    }

    // Delete by name pattern (for providers, companies, departments, etc.)
    if (["companies", "departments", "providers", "models", "api_keys"].includes(table)) {
      const nameResult = await env.DB
        .prepare(`
          DELETE FROM ${table}
        WHERE name LIKE 'Test %'
          OR name LIKE '% Test %'
          OR name LIKE 'test-%'
          OR name REGEXP '.*[0-9]{10,}$'
        `)
        .run();
      if (nameResult.meta?.changes) {
        deletedCount += nameResult.meta.changes;
      }
    }

    if (deletedCount > 0) {
      cleanedTables.push(table);
      totalDeleted += deletedCount;
    }
  }

  return {
    tables: cleanedTables,
    deletedRows: totalDeleted,
  };
}

/**
 * Handles POST /admin/test/cleanup - Clean up test data.
 */
export async function handleCleanup(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const result = await cleanupTestData(env);

  return withResponseLogging(
    Response.json({
      success: true,
      message: "Test data cleanup completed",
      ...result,
    }),
    context
  );
}

/**
 * Route handler for test cleanup endpoints.
 */
export function testCleanupRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // POST /admin/test/cleanup
  if (pathname === "/admin/test/cleanup" && request.method === "POST") {
    return handleCleanup(request, env, context);
  }

  return null;
}

/**
 * Error wrapper for test cleanup routes.
 */
export function testCleanupRouteHandlerWithErrorHandling(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  try {
    const result = testCleanupRouteHandler(request, env, context);
    if (result) {
      return result;
    }
    return Promise.resolve(
      Response.json({ error: "Not found" }, { status: 404 })
    );
  } catch (error) {
    if (error instanceof Error) {
      return Promise.resolve(
        Response.json(
          { error: error.message },
          { status: error.name === "ValidationError" ? 400 : 500 }
        )
      );
    }
    return Promise.resolve(
      Response.json({ error: "Unknown error" }, { status: 500 })
    );
  }
}
