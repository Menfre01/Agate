/**
 * Health Check Management API
 *
 * Admin endpoints for monitoring provider credential health.
 *
 * @module api/admin/health-check
 */

import type {
  Env,
  RequestContext,
  HealthStatus,
} from "@agate/shared/types";
import * as queries from "@agate/shared/db/queries.js";
import { NotFoundError, ApiError } from "@agate/shared/utils/errors/index.js";
import { withResponseLogging, logError } from "@agate/shared/middleware/logger.js";

/**
 * Credential health status response
 */
interface CredentialHealthStatus {
  id: string;
  provider_id: string;
  provider_name: string;
  credential_name: string;
  health_status: HealthStatus;
  last_health_check: number | null;
  is_active: boolean;
}

/**
 * Health check statistics response
 */
interface HealthCheckStatsResponse {
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  success_rate: number;
  total_tokens_used: number;
  last_check_at: number | null;
}

/**
 * Health check usage log response
 */
interface HealthCheckUsageLog {
  id: string;
  provider_id: string;
  provider_name: string;
  model_name: string;
  status: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  error_code: string | null;
  created_at: number;
}

/**
 * Handles GET /admin/providers/health-status - Get all credentials health status.
 */
export async function getHealthStatus(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const credentials = await queries.getAllCredentialsHealthStatus(env.DB);

  const response: CredentialHealthStatus[] = credentials.map((c) => ({
    id: c.id,
    provider_id: c.provider_id,
    provider_name: c.provider_name,
    credential_name: c.credential_name,
    health_status: c.health_status as HealthStatus,
    last_health_check: c.last_health_check,
    is_active: c.is_active,
  }));

  return withResponseLogging(Response.json({ credentials: response }), context);
}

/**
 * Handles POST /admin/providers/credentials/:id/health-check - Manually trigger health check for a credential.
 */
export async function triggerCredentialHealthCheck(
  _request: Request,
  env: Env,
  context: RequestContext,
  credentialId: string
): Promise<Response> {
  // Verify credential exists
  const credential = await queries.getProviderCredential(env.DB, credentialId);
  if (!credential) {
    throw new NotFoundError("Credential", credentialId);
  }

  // Get provider info
  const provider = await queries.getProvider(env.DB, credential.provider_id);
  if (!provider) {
    throw new NotFoundError("Provider", credential.provider_id);
  }

  // Get system API key
  const systemApiKeyResult = await env.DB
    .prepare('SELECT id FROM api_keys WHERE user_id = ?1 LIMIT 1')
    .bind(env.SYSTEM_USER_ID ?? "sys-health-user")
    .first<{ id: string }>();

  if (!systemApiKeyResult) {
    throw new ApiError(
      500,
      "SYSTEM_USER_NOT_FOUND",
      "System user API key not found. Please create a system user first."
    );
  }

  // Perform health check
  const { HealthCheckService } = await import("@agate/health/services/health-check.service.js");
  const service = new HealthCheckService(env);

  const result = await service.checkCredential(
    {
      id: credential.id,
      provider_id: credential.provider_id,
      credential_name: credential.credential_name,
      api_key_encrypted: credential.api_key_encrypted,
      base_url: credential.base_url,
      provider_name: provider.name,
      provider_base_url: provider.base_url,
      health_check_model_id: "",
      health_check_model_name: "",
    },
    systemApiKeyResult.id
  );

  // Update health status
  const newStatus = result.success ? "healthy" : "unhealthy";
  await queries.updateCredentialHealth(env.DB, credentialId, newStatus);

  return withResponseLogging(
    Response.json({
      credential_id: credentialId,
      success: result.success,
      health_status: newStatus,
      response_time_ms: result.responseTimeMs,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      error: result.error,
    }),
    context
  );
}

/**
 * Handles GET /admin/stats/health-check - Get health check statistics.
 */
export async function getHealthCheckStats(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);

  // Parse time range (default: last 24 hours)
  const endAt = Date.now();
  const startAt = parseInt(url.searchParams.get("start_at") ?? "") || (endAt - 24 * 60 * 60 * 1000);

  const stats = await queries.getHealthCheckStats(env.DB, {
    start_at: startAt,
    end_at: endAt,
  });

  // Calculate success rate
  const successRate = stats.total_checks > 0
    ? (stats.successful_checks / stats.total_checks) * 100
    : 0;

  // Get last check time
  const lastCheckResult = await env.DB
    .prepare(`
      SELECT created_at
      FROM usage_logs
      WHERE api_key_id = (SELECT id FROM api_keys WHERE user_id = ?1 LIMIT 1)
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(env.SYSTEM_USER_ID ?? "sys-health-user")
    .first<{ created_at: number }>();

  const response: HealthCheckStatsResponse = {
    total_checks: stats.total_checks,
    successful_checks: stats.successful_checks,
    failed_checks: stats.failed_checks,
    success_rate: Math.round(successRate * 100) / 100,
    total_tokens_used: stats.total_tokens_used,
    last_check_at: lastCheckResult?.created_at ?? null,
  };

  return withResponseLogging(Response.json(response), context);
}

/**
 * Handles GET /admin/stats/health-check/usage - Get health check usage logs.
 */
export async function getHealthCheckUsage(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);

  // Parse query parameters
  const startAt = parseInt(url.searchParams.get("start_at") ?? "") || (Date.now() - 24 * 60 * 60 * 1000);
  const endAt = parseInt(url.searchParams.get("end_at") ?? "") || Date.now();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const { logs, total } = await queries.getHealthCheckUsageLogs(env.DB, {
    start_at: startAt,
    end_at: endAt,
    limit,
    offset,
  });

  // Enrich logs with provider names
  const enrichedLogs: HealthCheckUsageLog[] = [];
  for (const log of logs) {
    const provider = await queries.getProvider(env.DB, log.provider_id);
    enrichedLogs.push({
      id: log.id,
      provider_id: log.provider_id,
      provider_name: provider?.name ?? "Unknown",
      model_name: log.model_name,
      status: log.status,
      input_tokens: log.input_tokens,
      output_tokens: log.output_tokens,
      total_tokens: log.total_tokens,
      error_code: log.error_code,
      created_at: log.created_at,
    });
  }

  return withResponseLogging(
    Response.json({
      total,
      limit,
      offset,
      logs: enrichedLogs,
    }),
    context
  );
}

/**
 * Routes health check related requests.
 */
export function healthCheckRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // GET /admin/providers/health-status
  if (pathname === "/admin/providers/health-status" && request.method === "GET") {
    return getHealthStatus(request, env, context);
  }

  // POST /admin/providers/credentials/:id/health-check
  const credentialCheckMatch = pathname.match(/^\/admin\/providers\/credentials\/([^/]+)\/health-check$/);
  if (credentialCheckMatch && request.method === "POST") {
    return triggerCredentialHealthCheck(request, env, context, credentialCheckMatch[1]!);
  }

  // GET /admin/stats/health-check
  if (pathname === "/admin/stats/health-check" && request.method === "GET") {
    return getHealthCheckStats(request, env, context);
  }

  // GET /admin/stats/health-check/usage
  if (pathname === "/admin/stats/health-check/usage" && request.method === "GET") {
    return getHealthCheckUsage(request, env, context);
  }

  return null;
}

/**
 * Error wrapper for health check routes.
 */
export function healthCheckRouteHandlerWithErrorHandling(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  try {
    const result = healthCheckRouteHandler(request, env, context);
    if (result) {
      return result;
    }
    return Promise.resolve(
      Response.json({ error: "Not found" }, { status: 404 })
    );
  } catch (error) {
    if (error instanceof ApiError) {
      logError(context, error);
      return Promise.resolve(
        Response.json({ error: error.message }, { status: error.statusCode })
      );
    }
    if (error instanceof Error) {
      logError(context, error);
    }
    return Promise.resolve(
      Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      )
    );
  }
}
