/**
 * Agate Admin Worker
 *
 * Management API for AI Gateway administration.
 * Handles user, company, department, API key, provider, model, and quota management.
 *
 * All endpoints require admin authentication.
 */

import type { RequestContext, Env } from "@agate/shared/types";
import { createLoggerMiddleware, logError, logResponse } from "@agate/shared/middleware/logger";
import { createRateLimitMiddleware, withRateLimitHeaders } from "@agate/shared/middleware/ratelimit";

// Admin API handlers
import { authRouteHandler } from "./api/admin/auth.js";
import { keysRouteHandler } from "./api/admin/keys.js";
import { providersRouteHandler } from "./api/admin/providers.js";
import { modelsRouteHandler } from "./api/admin/models.js";
import { statsRouteHandler, logsRouteHandler } from "./api/admin/stats.js";
import { quotasRouteHandler } from "./api/admin/quotas.js";
import { companiesRouteHandler } from "./api/admin/companies.js";
import { departmentsRouteHandler } from "./api/admin/departments.js";
import { usersRouteHandler } from "./api/admin/users.js";

/**
 * Creates request context from incoming request.
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
 */
function withCorsHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  return newResponse;
}

/**
 * Main request handler for Admin Worker.
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
    const rateLimitMiddleware = createRateLimitMiddleware({ limit: 1000, window: 60 });

    try {
      // Health check endpoint (no auth required)
      const url = new URL(request.url);
      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          service: "admin",
          timestamp: Date.now(),
          environment: env.ENVIRONMENT,
        });
      }

      // Apply middleware chain
      await loggerMiddleware(context);
      await rateLimitMiddleware(context, env);

      // Admin API routes (all require authentication via auth middleware)
      let response = await authRouteHandler(request, env, context);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

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

      response = await modelsRouteHandler(request, env, context);
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
          case "ConflictError":
            status = 409;
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
