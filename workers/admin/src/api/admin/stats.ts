/**
 * Statistics and Logs API
 *
 * Admin endpoints for usage statistics and logs.
 *
 * @module api/admin/stats
 */

import type {
  AuthContext,
  Env,
  RequestContext,
  UsageLogsQuery,
} from "@agate/shared/types";
import { UsageService } from "@agate/admin/services/usage.service.js";
import { ValidationError } from "@agate/shared/utils/errors/index.js";
import { withResponseLogging, logError } from "@agate/shared/middleware/logger.js";

/**
 * Handles GET /admin/stats/usage - Usage statistics.
 */
export async function getUsageStats(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const usageService = new UsageService(env);

  const query = {
    start_at: url.searchParams.get("start_at")
      ? parseInt(url.searchParams.get("start_at")!, 10)
      : Date.now() - 86400000, // Default: last 24 hours
    end_at: url.searchParams.get("end_at")
      ? parseInt(url.searchParams.get("end_at")!, 10)
      : Date.now(),
    company_id: url.searchParams.get("company_id") ?? undefined,
    department_id: url.searchParams.get("department_id") ?? undefined,
    user_id: url.searchParams.get("user_id") ?? undefined,
    model_id: url.searchParams.get("model_id") ?? undefined,
    group_by: url.searchParams.get("group_by") as
      | "hour"
      | "day"
      | "week"
      | "department"
      | "user"
      | "model"
      | undefined,
  };

  const stats = await usageService.getUsageStats(query);

  return withResponseLogging(Response.json(stats), context);
}

/**
 * Handles GET /admin/stats/tokens and /user/stats/tokens - Token usage summary.
 *
 * For /user/stats/tokens, automatically filters to the authenticated user's data.
 */
export async function getTokenUsage(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const usageService = new UsageService(env);

  // Check if this is a user endpoint (auto-filter to current user)
  const isUserEndpoint = url.pathname === "/user/stats/tokens";
  const auth = context.metadata.get("auth") as AuthContext | undefined;

  // Calculate time range based on period
  const period = url.searchParams.get("period") ?? "day";
  const now = Date.now();
  let startAt = now - 86400000; // Default: 24 hours

  switch (period) {
    case "hour":
      startAt = now - 3600000;
      break;
    case "day":
      startAt = now - 86400000;
      break;
    case "week":
      startAt = now - 604800000;
      break;
    case "month":
      startAt = now - 2592000000;
      break;
  }

  const summary = await usageService.getTokenUsage({
    start_at: startAt,
    end_at: now,
    company_id: url.searchParams.get("company_id") ?? undefined,
    department_id: url.searchParams.get("department_id") ?? undefined,
    user_id: isUserEndpoint ? auth?.userId : (url.searchParams.get("user_id") ?? undefined),
  });

  // Transform by_model to by_entity for frontend compatibility
  const byEntity = summary.by_model.map((m) => ({
    entity_type: "model" as const,
    entity_id: m.model_id,
    entity_name: m.model_name,
    total_tokens: m.total_tokens,
    input_tokens: m.input_tokens,
    output_tokens: m.output_tokens,
    request_count: m.requests,
  }));

  return withResponseLogging(
    Response.json({
      period,
      start_at: startAt,
      end_at: now,
      total_tokens: summary.total_tokens,
      input_tokens: summary.input_tokens,
      output_tokens: summary.output_tokens,
      by_entity: byEntity,
    }),
    context
  );
}

/**
 * Handles GET /user/stats/tokens/trend - Token usage trend by time period.
 *
 * For user endpoint, automatically filters to the authenticated user's data.
 */
export async function getTokenUsageTrend(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const usageService = new UsageService(env);
  const auth = context.metadata.get("auth") as AuthContext | undefined;

  // Get user_id from auth context for user endpoint
  const userId = auth?.userId;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Calculate time range based on period
  const period = url.searchParams.get("period") ?? "day";
  const now = Date.now();
  let startAt = now - 86400000;
  let groupBy: "hour" | "day" | "week" = "hour";

  switch (period) {
    case "day":
      startAt = now - 86400000;
      groupBy = "hour";
      break;
    case "week":
      startAt = now - 86400000 * 7;
      groupBy = "day";
      break;
    case "month":
      startAt = now - 86400000 * 30;
      groupBy = "week";
      break;
  }

  const stats = await usageService.getUsageStats({
    start_at: startAt,
    end_at: now,
    user_id: userId,
    group_by: groupBy,
  });

  return withResponseLogging(
    Response.json({
      period,
      start_at: startAt,
      end_at: now,
      grouped: stats.grouped,
    }),
    context
  );
}

/**
 * Handles GET /admin/stats/costs - Cost analysis.
 */
export async function getCostAnalysis(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(_request.url);
  const usageService = new UsageService(env);

  const now = Date.now();
  const startAt = url.searchParams.get("start_at")
    ? parseInt(url.searchParams.get("start_at")!, 10)
    : now - 86400000 * 7; // Default: last 7 days

  const endAt = url.searchParams.get("end_at")
    ? parseInt(url.searchParams.get("end_at")!, 10)
    : now;

  const costs = await usageService.getCostAnalysis({
    start_at: startAt,
    end_at: endAt,
    company_id: url.searchParams.get("company_id") ?? undefined,
  });

  return withResponseLogging(
    Response.json({
      start_at: startAt,
      end_at: endAt,
      ...costs,
    }),
    context
  );
}

/**
 * Handles GET /admin/stats/models - Model usage statistics.
 */
export async function getModelStats(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(_request.url);
  const usageService = new UsageService(env);

  const now = Date.now();
  const startAt = url.searchParams.get("start_at")
    ? parseInt(url.searchParams.get("start_at")!, 10)
    : now - 86400000 * 7; // Default: last 7 days

  const endAt = url.searchParams.get("end_at")
    ? parseInt(url.searchParams.get("end_at")!, 10)
    : now;

  const stats = await usageService.getModelStats({
    start_at: startAt,
    end_at: endAt,
    company_id: url.searchParams.get("company_id") ?? undefined,
  });

  return withResponseLogging(
    Response.json({
      start_at: startAt,
      end_at: endAt,
      stats,
    }),
    context
  );
}

/**
 * Handles GET /admin/stats/provider-models - Provider-Model usage statistics.
 */
export async function getProviderModelStats(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(_request.url);
  const usageService = new UsageService(env);

  const now = Date.now();
  const startAt = url.searchParams.get("start_at")
    ? parseInt(url.searchParams.get("start_at")!, 10)
    : now - 86400000 * 7; // Default: last 7 days

  const endAt = url.searchParams.get("end_at")
    ? parseInt(url.searchParams.get("end_at")!, 10)
    : now;

  const stats = await usageService.getProviderModelStats({
    start_at: startAt,
    end_at: endAt,
    company_id: url.searchParams.get("company_id") ?? undefined,
  });

  return withResponseLogging(
    Response.json({
      start_at: startAt,
      end_at: endAt,
      stats,
    }),
    context
  );
}

/**
 * Handles GET /admin/logs - Query usage logs.
 */
export async function getLogs(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);

  const query: UsageLogsQuery = {
    start_at: url.searchParams.get("start_at")
      ? parseInt(url.searchParams.get("start_at")!, 10)
      : undefined,
    end_at: url.searchParams.get("end_at")
      ? parseInt(url.searchParams.get("end_at")!, 10)
      : undefined,
    search: url.searchParams.get("search") ?? undefined,
    company_id: url.searchParams.get("company_id") ?? undefined,
    department_id: url.searchParams.get("department_id") ?? undefined,
    model_id: url.searchParams.get("model_id") ?? undefined,
    api_key_id: url.searchParams.get("api_key_id") ?? undefined,
    status: (url.searchParams.get("status") ?? undefined) as "success" | "error" | undefined,
    page: parseInt(url.searchParams.get("page") ?? "1", 10),
    page_size: Math.min(
      parseInt(url.searchParams.get("page_size") ?? "50", 10),
      500
    ),
  };

  const usageService = new UsageService(env);
  const logs = await usageService.queryLogs(query);

  return withResponseLogging(Response.json(logs), context);
}

/**
 * Routes stats requests for both admin and user endpoints.
 */
export function statsRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Handle both /admin/stats/* and /user/stats/* paths
  const isAdminPath = pathname.startsWith("/admin/stats");
  const isUserPath = pathname.startsWith("/user/stats");

  if (!isAdminPath && !isUserPath) {
    return null;
  }

  try {
    if ((pathname === "/admin/stats/tokens" || pathname === "/user/stats/tokens") && request.method === "GET") {
      return getTokenUsage(request, env, context);
    }

    if (pathname === "/user/stats/tokens/trend" && request.method === "GET") {
      return getTokenUsageTrend(request, env, context);
    }

    // Admin-only endpoints below
    if (!isAdminPath) {
      return null;
    }

    if (pathname === "/admin/stats/usage" && request.method === "GET") {
      return getUsageStats(request, env, context);
    }

    if (pathname === "/admin/stats/costs" && request.method === "GET") {
      return getCostAnalysis(request, env, context);
    }

    if (pathname === "/admin/stats/models" && request.method === "GET") {
      return getModelStats(request, env, context);
    }

    if (pathname === "/admin/stats/provider-models" && request.method === "GET") {
      return getProviderModelStats(request, env, context);
    }

    return Promise.resolve(
      Response.json({ error: "Method not allowed" }, { status: 405 })
    );
  } catch (error) {
    if (error instanceof Error) {
      logError(context, error);
    }
    const status = error instanceof ValidationError ? 400 : 500;
    return Promise.resolve(
      Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status }
      )
    );
  }
}

/**
 * Routes admin logs requests.
 */
export function logsRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/admin/logs" && request.method === "GET") {
    return getLogs(request, env, context);
  }

  return null;
}
