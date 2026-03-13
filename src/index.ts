/**
 * Agate - Your AI Gateway
 *
 * A Cloudflare Worker-based gateway for proxying AI API requests
 * with multi-tenant management, quota control, and usage tracking.
 */

import type { RequestContext } from "@/types/index.js";
import type { Env } from "@/types/index.js";
import { createAuthMiddleware } from "@/middleware/auth.js";
import { createLoggerMiddleware, logError, logResponse } from "@/middleware/logger.js";
import { createRateLimitMiddleware, withRateLimitHeaders } from "@/middleware/ratelimit.js";

// Proxy API handlers
import { messagesRouteHandler } from "@/api/proxy/anthropic.js";
import { modelsRouteHandler } from "@/api/proxy/models.js";

// Admin API handlers
import { keysRouteHandler } from "@/api/admin/keys.js";
import { providersRouteHandler } from "@/api/admin/providers.js";
import { modelsRouteHandler as adminModelsRouteHandler } from "@/api/admin/models.js";
import { statsRouteHandler, logsRouteHandler } from "@/api/admin/stats.js";
import { quotasRouteHandler } from "@/api/admin/quotas.js";
import { companiesRouteHandler } from "@/api/admin/companies.js";
import { departmentsRouteHandler } from "@/api/admin/departments.js";
import { usersRouteHandler } from "@/api/admin/users.js";

/**
 * Creates request context from incoming request.
 *
 * @param request - Incoming request
 * @returns Request context
 */
function createRequestContext(request: Request): RequestContext {
  const url = new URL(request.url);
  return {
    request,
    url,
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
    metadata: new Map(),
  };
}

/**
 * Handles CORS preflight requests.
 *
 * @param request - Incoming request
 * @returns CORS preflight response or null
 */
function handleCorsPreflight(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  return null;
}

/**
 * Adds CORS headers to response.
 *
 * @param response - Original response
 * @returns Response with CORS headers
 */
function withCorsHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  return newResponse;
}

/**
 * Main request handler.
 *
 * Routes requests to appropriate handlers based on path and method.
 *
 * @param request - Incoming request
 * @param env - Cloudflare Workers environment
 * @returns Response
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Create request context
    const context = createRequestContext(request);

    // Handle CORS preflight
    const corsResponse = handleCorsPreflight(request);
    if (corsResponse) {
      return corsResponse;
    }

    // Create middleware
    const loggerMiddleware = createLoggerMiddleware(env);
    const authMiddleware = createAuthMiddleware(env);
    const rateLimitMiddleware = createRateLimitMiddleware({ limit: 100, window: 60 });

    try {
      const url = new URL(request.url);

      // Health check endpoint (no middleware)
      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          timestamp: Date.now(),
          environment: env.ENVIRONMENT,
        });
      }

      // Apply middleware chain
      await loggerMiddleware(context);
      await authMiddleware(context);
      await rateLimitMiddleware(context, env);

      // Proxy API routes
      let response = await messagesRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await modelsRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      // Admin API routes
      response = await companiesRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await departmentsRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await usersRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await keysRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await providersRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await adminModelsRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await statsRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await logsRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await quotasRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      // 404 for unimplemented routes
      logResponse(context, 404);
      return withCorsHeaders(
        Response.json(
          {
            error: "Not Found",
            message: "The requested endpoint is not found",
            path: url.pathname,
          },
          { status: 404 }
        )
      );
    } catch (error) {
      // Log error
      if (error instanceof Error) {
        logError(context, error);
      }

      // Determine status code
      let status = 500;
      let message = "Internal Server Error";

      if (error instanceof Error) {
        switch (error.name) {
          case "UnauthorizedError":
          case "AuthenticationError":
            status = 401;
            message = error.message;
            break;
          case "RateLimitError":
            status = 429;
            message = error.message;
            break;
          case "ValidationError":
            status = 400;
            message = error.message;
            break;
          case "NotFoundError":
            status = 404;
            message = error.message;
            break;
          case "QuotaExceededError":
            status = 402;
            message = error.message;
            break;
        }
      }

      logResponse(context, status);

      return withCorsHeaders(
        Response.json(
          {
            error: {
              message,
              status,
              request_id: context.requestId,
            },
          },
          { status }
        )
      );
    }
  },
} satisfies ExportedHandler<Env>;
