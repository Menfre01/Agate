/**
 * @agate/shared - Shared code for Agate AI Gateway
 *
 * This package contains code shared between Proxy and Admin workers:
 * - Type definitions
 * - Utility functions
 * - Database queries
 * - Middleware
 * - Common services
 */

// Re-export types from types/index.js (excluding DTOs that are also in queries.ts)
export type {
  Company,
  Department,
  User,
  Model,
  Provider,
  ProviderCredential,
  DepartmentModel,
  ModelProvider,
  ApiKey,
  UsageLog,
  QuotaChange,
  UserRole,
  HealthStatus,
  AuthContext,
  ProxyMessageRequest,
  AnthropicUsage,
  Env,
  ErrorCode,
  ErrorResponse,
} from "./types/index.js";

// Export DTOs from queries.ts (for API operations)
export type {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  CreateProviderDto,
  UpdateProviderDto,
  CreateModelDto,
  UpdateModelDto,
  CreateUserDto,
  CreateCompanyDto,
  CreateDepartmentDto,
} from "./db/queries.js";

// Export UpdateQuotaDto from types
export type {
  UpdateQuotaDto,
} from "./types/index.js";

// Export error response interfaces from types
export type {
  ApiErrorResponse,
  ValidationErrorResponse,
} from "./types/index.js";

// Export utility functions
export { generateId } from "./utils/id-generator.js";
export { hashApiKey, extractKeyPrefix, generateApiKey } from "./utils/crypto.js";

// Export error classes (these take precedence over interfaces with same names)
export {
  ApiError,
  UnauthorizedError,
  QuotaExceededError,
  NotFoundError,
  ValidationError,
  InternalError,
  RateLimitError,
  ConflictError,
} from "./utils/errors/index.js";

// Export middleware
export {
  createLoggerMiddleware,
  getResponseLogger,
  logResponse,
  withResponseLogging,
  createErrorLog,
  logError,
} from "./middleware/logger.js";
export {
  createRateLimitMiddleware,
  checkRateLimit,
  getRateLimitHeaders,
  withRateLimitHeaders,
  type RateLimitConfig,
  type RateLimitResult,
  DEFAULT_RATE_LIMIT,
  ADMIN_RATE_LIMIT,
} from "./middleware/ratelimit.js";

// Export database queries
export * from "./db/queries.js";

// Export services
export { CacheService } from "./services/cache.service.js";
