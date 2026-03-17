/**
 * Authentication Middleware
 *
 * Validates API keys from request headers and attaches authentication context
 * to the request for downstream handlers.
 *
 * @module middleware/auth
 */

import type { AuthContext, Env, RequestContext } from "@agate/shared/types";
import { AuthService } from "@agate/admin/services/auth.service.js";
import { UnauthorizedError } from "@agate/shared/utils/errors/index.js";

/**
 * API key header name for authentication.
 */
const API_KEY_HEADER = "x-api-key";

/**
 * Bearer token prefix for Authorization header.
 */
const BEARER_PREFIX = "Bearer ";

/**
 * Extracts API key from request headers.
 *
 * Checks two locations in order:
 * 1. Authorization header with "Bearer" prefix
 * 2. x-api-key header
 *
 * @param request - Incoming request
 * @returns API key string or null if not found
 */
export function extractApiKey(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith(BEARER_PREFIX)) {
    return authHeader.slice(BEARER_PREFIX.length);
  }

  // Fall back to x-api-key header
  return request.headers.get(API_KEY_HEADER);
}

/**
 * Creates authentication middleware handler.
 *
 * Validates API key and attaches auth context to request context.
 * Skips authentication for health check endpoint.
 *
 * @param env - Cloudflare Workers environment
 * @returns Middleware handler function
 *
 * @example
 * ```ts
 * const authMiddleware = createAuthMiddleware(env);
 * await authMiddleware(context);
 * ```
 */
export function createAuthMiddleware(env: Env) {
  const authService = new AuthService(env);

  return async (context: RequestContext): Promise<void> => {
    const { request, url } = context;

    // Skip authentication for health check
    if (url.pathname === "/health") {
      return;
    }

    // Skip authentication for public proxy endpoints (handled downstream)
    // Admin endpoints always require authentication
    if (url.pathname.startsWith("/admin/")) {
      const apiKey = extractApiKey(request);

      if (!apiKey) {
        throw new UnauthorizedError("Missing API key");
      }

      const authContext = await authService.validateApiKey(apiKey);

      // Check if user is admin for admin endpoints
      if (authContext.userRole !== "admin") {
        throw new UnauthorizedError("Admin access required");
      }

      context.auth = authContext;
    }
  };
}

/**
 * Validates API key and returns authentication context.
 *
 * Use this for proxy endpoints that need authentication.
 *
 * @param request - Incoming request
 * @param env - Cloudflare Workers environment
 * @returns Authentication context
 * @throws {UnauthorizedError} If authentication fails
 */
export async function validateRequestAuth(
  request: Request,
  env: Env
): Promise<AuthContext> {
  const authService = new AuthService(env);
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    throw new UnauthorizedError("Missing API key");
  }

  return await authService.validateApiKey(apiKey);
}

/**
 * Wraps a handler with authentication requirement.
 *
 * @param handler - Request handler to wrap
 * @param env - Cloudflare Workers environment
 * @returns Wrapped handler with authentication
 *
 * @example
 * ```ts
 * const protectedHandler = withAuth(async (request, env, ctx) => {
 *   // ctx.auth is available here
 *   return Response.json({ data: "protected" });
 * }, env);
 * ```
 */
export function withAuth(
  handler: (request: Request, env: Env, context: RequestContext) => Promise<Response>,
  env: Env
) {
  return async (request: Request, ctx?: RequestContext): Promise<Response> => {
    const context: RequestContext = ctx ?? {
      request,
      url: new URL(request.url),
      requestId: crypto.randomUUID(),
      startTime: Date.now(),
      metadata: new Map(),
    };

    const authContext = await validateRequestAuth(request, env);
    context.auth = authContext;

    return await handler(request, env, context);
  };
}
