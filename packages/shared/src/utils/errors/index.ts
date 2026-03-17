/**
 * Custom error classes for API error handling.
 *
 * All errors support JSON serialization and follow RFC 7807 (Problem Details)
 * conventions where applicable.
 *
 * @module utils/errors
 */

/**
 * Base API error class with status code and error code support.
 *
 * Supports JSON serialization for error responses.
 *
 * @example
 * ```ts
 * throw new ApiError(429, "RATE_LIMITED", "Too many requests", {
 *   retryAfter: 60,
 * });
 * ```
 */
export class ApiError extends Error {
  /**
   * Creates a new API error.
   *
   * @param statusCode - HTTP status code
   * @param code - Machine-readable error code (e.g., "VALIDATION_ERROR")
   * @param message - Human-readable error message
   * @param details - Additional error details (will be JSON serialized)
   */
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";

    // Maintains proper stack trace in V8 environments
    if ("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts error to JSON-serializable object.
   *
   * @returns Plain object representation of the error
   */
  toJSON(): {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    return {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Authentication error (401 Unauthorized).
 *
 * Used when request lacks valid authentication credentials.
 *
 * @example
 * ```ts
 * if (!apiKey) {
 *   throw new UnauthorizedError("Missing API key");
 * }
 * ```
 */
export class UnauthorizedError extends ApiError {
  /**
   * Creates a new unauthorized error.
   *
   * @param message - Error message (default: "Unauthorized")
   */
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Payment/quota required error (402 Payment Required).
 *
 * Used when a quota has been exceeded or payment is required.
 *
 * @example
 * ```ts
 * if (usage.quotaUsed > usage.quotaLimit) {
 *   throw new QuotaExceededError({
 *     quota: usage.quotaLimit,
 *     used: usage.quotaUsed,
 *     entity: "api-requests",
 *   });
 * }
 * ```
 */
export class QuotaExceededError extends ApiError {
  /**
   * Creates a new quota exceeded error.
   *
   * @param details - Quota details including limit, usage, and entity type
   */
  constructor(details: { quota: number; used: number; entity: string }) {
    super(402, "QUOTA_EXCEEDED", "Quota exceeded", details);
    this.name = "QuotaExceededError";
  }
}

/**
 * Resource not found error (404 Not Found).
 *
 * Used when a requested resource doesn't exist.
 *
 * @example
 * ```ts
 * const user = await db.getUser(id);
 * if (!user) {
 *   throw new NotFoundError("User", id);
 * }
 * ```
 */
export class NotFoundError extends ApiError {
  /**
   * Creates a new not found error.
   *
   * @param resource - Resource type (e.g., "User", "API Key")
   * @param id - Resource identifier that was not found
   */
  constructor(resource: string, id: string) {
    super(404, "NOT_FOUND", `${resource} not found`, { id });
    this.name = "NotFoundError";
  }
}

/**
 * Validation error (400 Bad Request).
 *
 * Used when request validation fails.
 *
 * @example
 * ```ts
 * if (!email.includes("@")) {
 *   throw new ValidationError("Invalid email format", {
 *     email: "Must be a valid email address",
 *   });
 * }
 * ```
 */
export class ValidationError extends ApiError {
  /**
   * Creates a new validation error.
   *
   * @param message - Error message describing what failed validation
   * @param fields - Object mapping field names to error messages
   */
  constructor(message: string, public fields?: Record<string, string>) {
    super(400, "VALIDATION_ERROR", message, { fields });
    this.name = "ValidationError";
  }
}

/**
 * Internal server error (500 Internal Server Error).
 *
 * Used for unexpected server errors. Should be caught and logged
 * before returning a generic message to clients.
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logger.error(error);
 *   throw new InternalError("An unexpected error occurred");
 * }
 * ```
 */
export class InternalError extends ApiError {
  /**
   * Creates a new internal error.
   *
   * @param message - Error message (default: "Internal server error")
   * @param details - Optional error details (should not expose internals)
   */
  constructor(message = "Internal server error", details?: unknown) {
    super(500, "INTERNAL_ERROR", message, details);
    this.name = "InternalError";
  }
}

/**
 * Rate limit error (429 Too Many Requests).
 *
 * Used when a client has exceeded rate limits.
 *
 * @example
 * ```ts
 * if (requestCount > limit) {
 *   throw new RateLimitError({
 *     limit: 100,
 *     remaining: 0,
 *     resetAt: new Date(Date.now() + 60000),
 *   });
 * }
 * ```
 */
export class RateLimitError extends ApiError {
  /**
   * Creates a new rate limit error.
   *
   * @param details - Rate limit details
   */
  constructor(details: {
    limit: number;
    remaining: number;
    resetAt: Date;
  }) {
    super(429, "RATE_LIMITED", "Rate limit exceeded", details);
    this.name = "RateLimitError";
  }
}

/**
 * Conflict error (409 Conflict).
 *
 * Used when a request conflicts with current state.
 *
 * @example
 * ```ts
 * const existing = await db.findByEmail(email);
 * if (existing) {
 *   throw new ConflictError("User", "email", email);
 * }
 * ```
 */
export class ConflictError extends ApiError {
  /**
   * Creates a new conflict error.
   *
   * @param resource - Resource type
   * @param field - Field that caused the conflict
   * @param value - Value that conflicts
   */
  constructor(resource: string, field: string, value: string) {
    super(
      409,
      "CONFLICT",
      `${resource} with this ${field} already exists`,
      { field, value }
    );
    this.name = "ConflictError";
  }
}
