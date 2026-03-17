/**
 * Agate Health Check Worker
 *
 * Periodically checks all active provider credentials using Cron triggers.
 * Updates health status and records usage to the system user account.
 *
 * Trigger: Every 5 minutes (via cron)
 *
 * @module index
 */

import type { Env } from "@agate/shared/types";
import { HealthCheckService } from "./services/health-check.service.js";

/**
 * Cloudflare Workers ScheduledEvent type.
 */
interface ScheduledEvent {
  /** Scheduled time (Unix timestamp in milliseconds) */
  scheduledTime: number;
  /** Cron string that triggered this event */
  cron: string;
}

/**
 * Exported Worker handler.
 */
export default {
  /**
   * Handles scheduled Cron events.
   *
   * @param event - Scheduled event
   * @param env - Environment bindings
   */
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const startTime = Date.now();
    console.log(`[HealthCheck] Starting at ${new Date(startTime).toISOString()}`);
    console.log(`[HealthCheck] Cron: ${event.cron}`);

    try {
      const service = new HealthCheckService(env);
      const summary = await service.runAllChecks();

      const duration = Date.now() - startTime;
      console.log(`[HealthCheck] Completed in ${duration}ms`);
      console.log(`[HealthCheck] Total: ${summary.total}, Successful: ${summary.successful}, Failed: ${summary.failed}, Skipped: ${summary.skipped}`);
      console.log(`[HealthCheck] Tokens consumed: ${summary.totalTokens}`);

      // Log individual failures
      for (const result of summary.results) {
        if (!result.success) {
          console.error(
            `[HealthCheck] Failed: ${result.credentialName} (${result.credentialId}) - ${result.error}`
          );
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[HealthCheck] Error after ${duration}ms:`, error);
      throw error; // Re-throw to trigger retry
    }
  },

  /**
   * Handles HTTP requests (optional, for manual triggering).
   *
   * GET / - Returns health check status
   * POST / - Manually triggers health check
   *
   * @param request - HTTP request
   * @param env - Environment bindings
   * @param ctx - Execution context
   */
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/" && request.method === "GET") {
      return Response.json({
        status: "healthy",
        worker: "agate-health",
        timestamp: new Date().toISOString(),
      });
    }

    // Manual trigger endpoint (protected)
    if (url.pathname === "/trigger" && request.method === "POST") {
      try {
        const service = new HealthCheckService(env);
        const summary = await service.runAllChecks();

        return Response.json({
          success: true,
          summary: {
            total: summary.total,
            successful: summary.successful,
            failed: summary.failed,
            skipped: summary.skipped,
            total_tokens: summary.totalTokens,
          },
          results: summary.results.map((r) => ({
            credential_id: r.credentialId,
            credential_name: r.credentialName,
            success: r.success,
            error: r.error,
            response_time_ms: r.responseTimeMs,
          })),
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env, {
  scheduled: (event: ScheduledEvent, env: Env) => Promise<void>;
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
}>;
