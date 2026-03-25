/**
 * Agate Proxy Worker
 *
 * High-performance AI API proxy for handling Anthropic Messages API requests.
 * This worker is optimized for low-latency proxy operations.
 *
 * Routes:
 * - /v1/messages - Anthropic Messages API proxy
 * - /v1/models - Model list endpoint
 * - /health - Health check
 */

import type { RequestContext, Env } from "@agate/shared/types";
import { createLoggerMiddleware, logError, logResponse } from "@agate/shared/middleware/logger";
import { createRateLimitMiddleware, withRateLimitHeaders } from "@agate/shared/middleware/ratelimit";

// Proxy API handlers
import { messagesRouteHandler } from "./api/proxy/anthropic.js";
import { modelsRouteHandler } from "./api/proxy/models.js";

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
 *
 * IMPORTANT: This function MUST NOT create a new Response with response.body,
 * as that can cause "ReadableStream is disturbed" errors when the body has already
 * been used or is locked. Instead, we only modify headers directly on the existing
 * Response object, which is safe and does not disturb the stream.
 *
 * Route handlers are responsible for setting X-CORS-Handled to indicate they've
 * already added CORS headers, preventing duplicate processing.
 */
function withCorsHeaders(response: Response): Response {
  // Check if CORS handling is already done by the handler
  // (indicated by X-CORS-Handled header)
  if (response.headers.has("X-CORS-Handled")) {
    return response;
  }

  // Check if CORS headers are already present
  if (response.headers.has("Access-Control-Allow-Origin")) {
    return response;
  }

  // SAFELY add CORS header by directly modifying the existing Response object.
  // This does NOT disturb the body stream because we're only changing headers.
  // Note: In most cases, Response.headers.set() is safe even if the body is locked.
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

/**
 * Main request handler for Proxy Worker.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Create request context
    const context = createRequestContext(request);

    // Create logger middleware
    const loggerMiddleware = createLoggerMiddleware(env);

    // Handle CORS preflight
    const corsResponse = handleCorsPreflight(request);
    if (corsResponse) {
      await loggerMiddleware(context);
      logResponse(context, 204);
      return corsResponse;
    }

    const url = new URL(request.url);
    const isDev = env.ENVIRONMENT === "development" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const rateLimit = isDev ? { limit: 10000, window: 60 } : { limit: 100, window: 60 };
    const rateLimitMiddleware = createRateLimitMiddleware(rateLimit);

    try {
      // Health check endpoint
      if (url.pathname === "/health") {
        await loggerMiddleware(context);
        const response = Response.json({
          status: "ok",
          service: "proxy",
          timestamp: Date.now(),
          environment: env.ENVIRONMENT,
        });
        logResponse(context, 200);
        return withCorsHeaders(response);
      }

      // Apply middleware chain (logger only, no auth for proxy - handled downstream)
      await loggerMiddleware(context);
      await rateLimitMiddleware(context, env);

      // Proxy API routes
      let response = await messagesRouteHandler(request, env, context, ctx);
      if (response) return withCorsHeaders(withRateLimitHeaders(response, context));

      response = await modelsRouteHandler(request, env, context);
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
      let errorType = "internal_error";

      if (error instanceof Error) {
        switch (error.name) {
          case "UnauthorizedError":
          case "AuthenticationError":
            status = 401;
            message = error.message;
            errorType = "authentication_error";
            break;
          case "RateLimitError":
            status = 429;
            message = error.message;
            errorType = "rate_limit_error";
            break;
          case "ValidationError":
            status = 400;
            message = error.message;
            errorType = "invalid_request_error";
            break;
          case "NotFoundError":
            status = 404;
            message = error.message;
            errorType = "not_found_error";
            break;
          case "QuotaExceededError":
            status = 402;
            message = error.message;
            errorType = "quota_exceeded_error";
            break;
        }
      }

      logResponse(context, status);

      return withCorsHeaders(
        Response.json(
          {
            error: {
              type: errorType,
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
