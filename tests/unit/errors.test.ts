/**
 * Tests for error classes
 */
import { describe, it, expect } from "vitest";
import {
  ApiError,
  UnauthorizedError,
  QuotaExceededError,
  NotFoundError,
  ValidationError,
  InternalError,
  RateLimitError,
  ConflictError,
} from "@/utils/errors";

describe("errors", () => {
  describe("ApiError", () => {
    it("should create error with status code and code", () => {
      const error = new ApiError(429, "RATE_LIMITED", "Too many requests");

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMITED");
      expect(error.message).toBe("Too many requests");
      expect(error.name).toBe("ApiError");
    });

    it("should include details in error", () => {
      const details = { retryAfter: 60 };
      const error = new ApiError(429, "RATE_LIMITED", "Too many requests", details);

      expect(error.details).toEqual(details);
    });

    it("should serialize to JSON", () => {
      const error = new ApiError(429, "RATE_LIMITED", "Too many requests", {
        retryAfter: 60,
      });

      const json = error.toJSON();

      expect(json).toEqual({
        statusCode: 429,
        code: "RATE_LIMITED",
        message: "Too many requests",
        details: { retryAfter: 60 },
      });
    });

    it("should handle undefined details in toJSON", () => {
      const error = new ApiError(404, "NOT_FOUND", "Not found");

      const json = error.toJSON();

      expect(json.details).toBeUndefined();
    });

    it("should maintain stack trace", () => {
      const error = new ApiError(500, "INTERNAL_ERROR", "Something went wrong");

      expect(error.stack).toBeDefined();
    });
  });

  describe("UnauthorizedError", () => {
    it("should create 401 error with default message", () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Unauthorized");
      expect(error.name).toBe("UnauthorizedError");
    });

    it("should accept custom message", () => {
      const error = new UnauthorizedError("Invalid API key");

      expect(error.message).toBe("Invalid API key");
      expect(error.statusCode).toBe(401);
    });
  });

  describe("QuotaExceededError", () => {
    it("should create 402 error with quota details", () => {
      const details = { quota: 1000, used: 1200, entity: "api-requests" };
      const error = new QuotaExceededError(details);

      expect(error.statusCode).toBe(402);
      expect(error.code).toBe("QUOTA_EXCEEDED");
      expect(error.message).toBe("Quota exceeded");
      expect(error.details).toEqual(details);
      expect(error.name).toBe("QuotaExceededError");
    });

    it("should serialize quota details to JSON", () => {
      const details = { quota: 1000, used: 1200, entity: "api-requests" };
      const error = new QuotaExceededError(details);

      const json = error.toJSON();

      expect(json.details).toEqual(details);
    });
  });

  describe("NotFoundError", () => {
    it("should create 404 error with resource and id", () => {
      const error = new NotFoundError("User", "user-123");

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("User not found");
      expect(error.details).toEqual({ id: "user-123" });
      expect(error.name).toBe("NotFoundError");
    });

    it("should format message correctly", () => {
      const error = new NotFoundError("API Key", "key-abc");

      expect(error.message).toBe("API Key not found");
    });
  });

  describe("ValidationError", () => {
    it("should create 400 error with message", () => {
      const error = new ValidationError("Invalid input");

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Invalid input");
      expect(error.name).toBe("ValidationError");
      expect(error.fields).toBeUndefined();
    });

    it("should include field-specific errors", () => {
      const fields = {
        email: "Must be a valid email address",
        password: "Must be at least 8 characters",
      };
      const error = new ValidationError("Validation failed", fields);

      expect(error.fields).toEqual(fields);
      expect(error.details).toEqual({ fields });
    });
  });

  describe("InternalError", () => {
    it("should create 500 error with default message", () => {
      const error = new InternalError();

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.message).toBe("Internal server error");
      expect(error.name).toBe("InternalError");
    });

    it("should accept custom message", () => {
      const error = new InternalError("Database connection failed");

      expect(error.message).toBe("Database connection failed");
    });

    it("should accept optional details", () => {
      const error = new InternalError("Database failed", { table: "users" });

      expect(error.details).toEqual({ table: "users" });
    });
  });

  describe("RateLimitError", () => {
    it("should create 429 error with rate limit details", () => {
      const resetAt = new Date(Date.now() + 60000);
      const details = { limit: 100, remaining: 0, resetAt };
      const error = new RateLimitError(details);

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMITED");
      expect(error.message).toBe("Rate limit exceeded");
      expect(error.details).toEqual(details);
      expect(error.name).toBe("RateLimitError");
    });
  });

  describe("ConflictError", () => {
    it("should create 409 error with resource, field, and value", () => {
      const error = new ConflictError("User", "email", "test@example.com");

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe("User with this email already exists");
      expect(error.details).toEqual({ field: "email", value: "test@example.com" });
      expect(error.name).toBe("ConflictError");
    });

    it("should format message correctly", () => {
      const error = new ConflictError("API Key", "name", "production-key");

      expect(error.message).toBe("API Key with this name already exists");
    });
  });

  describe("Error inheritance", () => {
    it("should allow instanceof checks for all error types", () => {
      const apiError = new ApiError(500, "TEST", "test");
      const unauthorizedError = new UnauthorizedError();
      const quotaError = new QuotaExceededError({ quota: 100, used: 150, entity: "test" });
      const notFoundError = new NotFoundError("Test", "123");
      const validationError = new ValidationError("test");
      const internalError = new InternalError();
      const rateLimitError = new RateLimitError({
        limit: 100,
        remaining: 0,
        resetAt: new Date(),
      });
      const conflictError = new ConflictError("Test", "field", "value");

      expect(apiError instanceof ApiError).toBe(true);
      expect(apiError instanceof Error).toBe(true);

      expect(unauthorizedError instanceof ApiError).toBe(true);
      expect(unauthorizedError instanceof UnauthorizedError).toBe(true);

      expect(quotaError instanceof ApiError).toBe(true);
      expect(quotaError instanceof QuotaExceededError).toBe(true);

      expect(notFoundError instanceof ApiError).toBe(true);
      expect(notFoundError instanceof NotFoundError).toBe(true);

      expect(validationError instanceof ApiError).toBe(true);
      expect(validationError instanceof ValidationError).toBe(true);

      expect(internalError instanceof ApiError).toBe(true);
      expect(internalError instanceof InternalError).toBe(true);

      expect(rateLimitError instanceof ApiError).toBe(true);
      expect(rateLimitError instanceof RateLimitError).toBe(true);

      expect(conflictError instanceof ApiError).toBe(true);
      expect(conflictError instanceof ConflictError).toBe(true);
    });
  });
});
