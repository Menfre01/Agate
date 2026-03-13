/**
 * Logger Middleware
 *
 * Logs request and response information for monitoring and debugging.
 * Attaches request ID and timing information to context.
 *
 * @module middleware/logger
 */

import type { RequestContext, Env } from "@/types/index.js";

/**
 * Log level enumeration.
 */
type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Log entry structure.
 */
interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Timestamp */
  timestamp: number;
  /** Request ID */
  request_id: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Response status (for response logs) */
  status?: number;
  /** Response time in ms (for response logs) */
  response_time_ms?: number;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Creates logger middleware.
 *
 * Generates request ID, logs incoming requests, and logs response details.
 *
 * @param env - Cloudflare Workers environment
 * @returns Middleware handler function
 *
 * @example
 * ```ts
 * const loggerMiddleware = createLoggerMiddleware(env);
 * await loggerMiddleware(context);
 * ```
 */
export function createLoggerMiddleware(env: Env) {
  const isDev = env.ENVIRONMENT === "development";

  return async (context: RequestContext): Promise<void> => {
    const { request, url, requestId, startTime } = context;

    // Log incoming request
    logRequest({
      level: "info",
      timestamp: Date.now(),
      request_id: requestId,
      method: request.method,
      path: url.pathname + url.search,
      headers: isDev ? headersToObject(request.headers) : undefined,
    });

    // Store response logger for later use
    context.metadata.set("logResponse", (status: number) => {
      const responseTimeMs = Date.now() - startTime;

      logRequest({
        level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        timestamp: Date.now(),
        request_id: requestId,
        method: request.method,
        path: url.pathname + url.search,
        status,
        response_time_ms: responseTimeMs,
      });
    });
  };
}

/**
 * Logs a request entry.
 *
 * In production, this could send logs to a logging service.
 * For now, it uses console.log with structured output.
 *
 * @param entry - Log entry to output
 */
function logRequest(entry: LogEntry & { headers?: Record<string, string> }): void {
  const { headers, ...rest } = entry;
  console.log(JSON.stringify(rest));
}

/**
 * Converts Headers object to plain object (for development logging).
 *
 * @param headers - Headers object
 * @returns Plain object with header values
 */
function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    // Skip sensitive headers
    if (!["authorization", "x-api-key"].includes(key.toLowerCase())) {
      obj[key] = value;
    }
  });
  return obj;
}

/**
 * Gets response logger from context.
 *
 * Call this in your route handler to log the response.
 *
 * @param context - Request context
 * @returns Response logger function or null
 *
 * @example
 * ```ts
 * const logResponse = getResponseLogger(context);
 * return logResponse(response);
 * ```
 */
export function getResponseLogger(context: RequestContext): ((status: number) => void) | null {
  return (context.metadata.get("logResponse") as (status: number) => void) ?? null;
}

/**
 * Logs a response with status code.
 *
 * @param context - Request context
 * @param status - HTTP status code
 */
export function logResponse(context: RequestContext, status: number): void {
  const logger = getResponseLogger(context);
  if (logger) {
    logger(status);
  }
}

/**
 * Wraps a Response to automatically log when sent.
 *
 * @param response - Original response
 * @param context - Request context
 * @returns Wrapped response
 */
export function withResponseLogging(response: Response, context: RequestContext): Response {
  const logResponse = getResponseLogger(context);
  if (logResponse) {
    logResponse(response.status);
  }
  return response;
}

/**
 * Creates an error log entry.
 *
 * @param context - Request context
 * @param error - Error object
 * @returns Log entry
 */
export function createErrorLog(context: RequestContext, error: Error): LogEntry {
  return {
    level: "error",
    timestamp: Date.now(),
    request_id: context.requestId,
    method: context.request.method,
    path: context.url.pathname + context.url.search,
    error: error.message,
    stack: error.stack,
  };
}

/**
 * Logs an error.
 *
 * @param context - Request context
 * @param error - Error to log
 */
export function logError(context: RequestContext, error: Error): void {
  const entry = createErrorLog(context, error);
  console.error(JSON.stringify(entry));
}
