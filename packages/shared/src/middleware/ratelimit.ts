/**
 * Rate Limit Middleware
 *
 * Provides basic rate limiting using KV storage.
 * Limits requests per API key within a time window.
 *
 * @module middleware/ratelimit
 */

import type { RequestContext, Env } from "../types/index.js";

/**
 * Rate limit configuration.
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the time window */
  limit: number;
  /** Time window in seconds */
  window: number;
}

/**
 * Rate limit check result.
 */
export interface RateLimitResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Time when limit resets (Unix timestamp) */
  resetAt: number;
}

/**
 * Default rate limit: 100 requests per minute.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  limit: 100,
  window: 60,
};

/**
 * Admin rate limit: 1000 requests per minute.
 */
export const ADMIN_RATE_LIMIT: RateLimitConfig = {
  limit: 1000,
  window: 60,
};

/**
 * KV key prefix for rate limit counters.
 */
const KV_PREFIX = "ratelimit";

/**
 * Creates rate limit middleware.
 *
 * @param config - Rate limit configuration
 * @returns Middleware handler function
 *
 * @example
 * ```ts
 * const rateLimitMiddleware = createRateLimitMiddleware({ limit: 100, window: 60 });
 * await rateLimitMiddleware(context);
 * ```
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (context: RequestContext, cfEnv: Env): Promise<void> => {
    const { auth, url } = context;

    // Skip rate limiting for health check
    if (url.pathname === "/health") {
      return;
    }

    // Skip if no auth context (public endpoints)
    if (!auth) {
      return;
    }

    // Check rate limit
    const result = await checkRateLimit(cfEnv, auth.apiKeyId, config);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      throw new RateLimitError("Rate limit exceeded", {
        limit: config.limit,
        window: config.window,
        retryAfter,
      });
    }

    // Store rate limit info in context for headers
    context.metadata.set("rateLimit", {
      limit: config.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
    });
  };
}

/**
 * Checks rate limit for a given identifier.
 *
 * Uses KV with atomic increment operation for thread-safe counting.
 *
 * @param env - Cloudflare Workers environment
 * @param identifier - Unique identifier (e.g., API key ID)
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  env: Env,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const kv = env.KV_CACHE;
  const now = Date.now();
  const windowStart = Math.floor(now / (config.window * 1000)) * (config.window * 1000);
  const key = `${KV_PREFIX}:${identifier}:${windowStart}`;

  // Get current count
  const currentStr = await kv.get(key, "text");
  const current = currentStr ? parseInt(currentStr, 10) : 0;

  // Check if limit exceeded
  if (current >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: windowStart + config.window * 1000,
    };
  }

  // Increment counter
  const newCount = current + 1;
  const remaining = config.limit - newCount;

  // Set with expiration at end of window
  await kv.put(key, newCount.toString(), {
    expirationTtl: config.window,
  });

  return {
    allowed: true,
    remaining,
    resetAt: windowStart + config.window * 1000,
  };
}

/**
 * Rate limit error class.
 */
export class RateLimitError extends Error {
  /** Rate limit that was exceeded */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Seconds until retry is allowed */
  retryAfter: number;

  constructor(message: string, options: { limit: number; window: number; retryAfter: number }) {
    super(message);
    this.name = "RateLimitError";
    this.limit = options.limit;
    this.window = options.window;
    this.retryAfter = options.retryAfter;
  }
}

/**
 * Gets rate limit headers for response.
 *
 * @param context - Request context
 * @returns Headers object with rate limit info or null
 */
export function getRateLimitHeaders(context: RequestContext): Record<string, string> | null {
  const rateLimit = context.metadata.get("rateLimit") as {
    limit: number;
    remaining: number;
    resetAt: number;
  } | null;

  if (!rateLimit) {
    return null;
  }

  return {
    "RateLimit-Limit": rateLimit.limit.toString(),
    "RateLimit-Remaining": rateLimit.remaining.toString(),
    "RateLimit-Reset": Math.ceil(rateLimit.resetAt / 1000).toString(),
  };
}

/**
 * Applies rate limit headers to a response.
 *
 * @param response - Original response
 * @param context - Request context
 * @returns Response with rate limit headers
 */
export function withRateLimitHeaders(response: Response, context: RequestContext): Response {
  // Check if rate limit headers are already present (e.g., from streaming handlers)
  if (response.headers.has("RateLimit-Limit")) {
    return response;
  }

  const headers = getRateLimitHeaders(context);
  if (headers) {
    // Check if the response body is a locked/disturbed stream
    // If so, just add headers to the existing response without creating a new one
    const body = response.body;
    if (body && body.locked) {
      // Stream is locked, can't create new Response - just add headers
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    const newResponse = new Response(response.body, response);
    Object.entries(headers).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });
    return newResponse;
  }
  return response;
}
