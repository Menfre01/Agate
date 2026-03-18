/**
 * User Statistics API
 *
 * Endpoints for normal users to view their own usage statistics.
 * Automatically filters data to the current user.
 *
 * Endpoints:
 * - GET /user/stats/tokens - 当前用户的 Token 用量
 * - GET /user/stats/usage - 当前用户的使用统计
 * - GET /user/stats/models - 当前用户的模型使用情况
 */

import type {
  Env,
  RequestContext,
} from "@/types/index.js";
import { UsageService } from "@/services/usage.service.js";
import { withResponseLogging } from "@/middleware/logger.js";

/**
 * Handles GET /user/stats/tokens - Current user's token usage
 *
 * Similar to /admin/stats/tokens but automatically filters to current user.
 */
export async function getUserTokenUsage(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(_request.url);
  const usageService = new UsageService(env);
  const auth = context.auth;

  if (!auth) {
    throw new Error("Authentication required");
  }

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

  // Automatically filter to current user
  const summary = await usageService.getTokenUsage({
    start_at: startAt,
    end_at: now,
    user_id: auth.userId, // Auto-filter to current user
  });

  return withResponseLogging(
    Response.json({
      period,
      start_at: startAt,
      end_at: now,
      ...summary,
    }),
    context
  );
}

/**
 * Handles GET /user/stats/usage - Current user's usage statistics
 */
export async function getUserUsageStats(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const usageService = new UsageService(env);
  const auth = context.auth;

  if (!auth) {
    throw new Error("Authentication required");
  }

  const query = {
    start_at: url.searchParams.get("start_at")
      ? parseInt(url.searchParams.get("start_at")!, 10)
      : Date.now() - 86400000, // Default: last 24 hours
    end_at: url.searchParams.get("end_at")
      ? parseInt(url.searchParams.get("end_at")!, 10)
      : Date.now(),
    user_id: auth.userId, // Auto-filter to current user
    group_by: url.searchParams.get("group_by") as
      | "day"
      | "model"
      | undefined,
  };

  const stats = await usageService.getUsageStats(query);

  return withResponseLogging(Response.json(stats), context);
}

/**
 * Handles GET /user/stats/models - Current user's model usage
 */
export async function getUserModelStats(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(_request.url);
  const usageService = new UsageService(env);
  const auth = context.auth;

  if (!auth) {
    throw new Error("Authentication required");
  }

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
    user_id: auth.userId, // Auto-filter to current user
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
 * Routes user stats requests.
 */
export function userStatsRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/user/stats")) {
    return null;
  }

  try {
    if (pathname === "/user/stats/tokens" && request.method === "GET") {
      return getUserTokenUsage(request, env, context);
    }

    if (pathname === "/user/stats/usage" && request.method === "GET") {
      return getUserUsageStats(request, env, context);
    }

    if (pathname === "/user/stats/models" && request.method === "GET") {
      return getUserModelStats(request, env, context);
    }

    return Promise.resolve(
      Response.json({ error: "Method not allowed" }, { status: 405 })
    );
  } catch (error) {
    const status = error instanceof Error && error.name === "ValidationError" ? 400 : 500;
    return Promise.resolve(
      Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status }
      )
    );
  }
}
