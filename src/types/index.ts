/**
 * AI Gateway Type Definitions
 *
 * This file contains all TypeScript type definitions for the AI Gateway project.
 * Types are organized into three categories:
 * 1. Entity Types - Database entity types matching D1 schema
 * 2. DTO Types - API request/response data transfer objects
 * 3. Error Types - Error codes and error interfaces
 *
 * All entity types match the database schema defined in prd.md Section 3.
 */

// =============================================================================
// Entity Types (Database Schema)
// =============================================================================

/**
 * Company entity representing an organization
 * @see prd.md Section 3.2.1
 */
export interface Company {
  /** Unique identifier */
  id: string;
  /** Company name (unique) */
  name: string;
  /** Total quota pool (manual refill, use until depleted) */
  quota_pool: number;
  /** Amount used from quota pool */
  quota_used: number;
  /** Daily quota limit (auto-resets daily at UTC 0:00) */
  quota_daily: number;
  /** Amount used from daily quota */
  daily_used: number;
  /** Last daily quota reset timestamp (UTC 0:00) */
  last_reset_at: number | null;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * Department entity representing a division within a company
 * @see prd.md Section 3.2.1
 */
export interface Department {
  /** Unique identifier */
  id: string;
  /** Parent company ID */
  company_id: string;
  /** Department name */
  name: string;
  /** Department-level quota pool */
  quota_pool: number;
  /** Amount used from quota pool */
  quota_used: number;
  /** Department daily quota limit */
  quota_daily: number;
  /** Amount used from daily quota */
  daily_used: number;
  /** Last daily quota reset timestamp */
  last_reset_at: number | null;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * User role enumeration
 */
export type UserRole = 'admin' | 'user';

/**
 * User entity representing an individual user
 * @see prd.md Section 3.2.1
 */
export interface User {
  /** Unique identifier */
  id: string;
  /** User email (unique) */
  email: string;
  /** User display name */
  name: string | null;
  /** Company ID */
  company_id: string;
  /** Department ID (optional) */
  department_id: string | null;
  /** User role */
  role: UserRole;
  /** User daily quota limit */
  quota_daily: number;
  /** Amount used from daily quota (aggregated from all API keys) */
  quota_used: number;
  /** Whether user is active */
  is_active: boolean;
  /** Last quota reset timestamp */
  last_reset_at: number | null;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * Provider entity representing an AI service provider
 * @see prd.md Section 3.2.2
 */
export interface Provider {
  /** Unique identifier */
  id: string;
  /** Provider unique identifier (e.g., 'anthropic', 'openai') */
  name: string;
  /** Human-readable display name */
  display_name: string;
  /** API endpoint base URL (supports dynamic configuration) */
  base_url: string;
  /** API version (e.g., '2023-06-01') */
  api_version: string | null;
  /** Whether provider is active */
  is_active: boolean;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * Model entity representing an AI model
 * @see prd.md Section 3.2.2
 */
export interface Model {
  /** Unique identifier */
  id: string;
  /** Model unique identifier (e.g., 'claude-3-sonnet') */
  model_id: string;
  /** Human-readable display name */
  display_name: string;
  /** Context window size (tokens) */
  context_window: number;
  /** Maximum output tokens */
  max_tokens: number;
  /** Whether model is active */
  is_active: boolean;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * ModelProvider association (many-to-many relationship)
 * @see prd.md Section 3.2.2
 */
export interface ModelProvider {
  /** Unique identifier */
  id: string;
  /** Model ID */
  model_id: string;
  /** Provider ID */
  provider_id: string;
  /** Input price per 1K tokens (USD) */
  input_price: number;
  /** Output price per 1K tokens (USD) */
  output_price: number;
  /** Provider priority (higher = preferred) */
  priority: number;
  /** Whether association is active */
  is_active: boolean;
  /** Creation timestamp */
  created_at: number;
}

/**
 * DepartmentModel configuration for department-level model access
 * @see prd.md Section 3.2.2
 */
export interface DepartmentModel {
  /** Unique identifier */
  id: string;
  /** Department ID */
  department_id: string;
  /** Model ID */
  model_id: string;
  /** Whether department is allowed to use this model */
  is_allowed: boolean;
  /** Daily quota for this model in the department */
  daily_quota: number;
  /** Creation timestamp */
  created_at: number;
}

/**
 * Health status enumeration for provider credentials
 */
export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

/**
 * Request status enumeration
 */
export type RequestStatus = 'success' | 'error';

/**
 * Entity type enumeration for quota operations
 */
export type EntityType = 'api_key' | 'department' | 'company';

/**
 * Quota change type enumeration
 */
export type QuotaChangeType = 'set' | 'add' | 'reset' | 'bonus';

/**
 * ProviderCredential entity for storing encrypted API keys
 * @see prd.md Section 3.2.3
 */
export interface ProviderCredential {
  /** Unique identifier */
  id: string;
  /** Provider ID */
  provider_id: string;
  /** Credential name (for identification) */
  credential_name: string;
  /** Encrypted API key */
  api_key_encrypted: string;
  /** Whether credential is active */
  is_active: boolean;
  /** Credential priority (higher = preferred) */
  priority: number;
  /** Load balancing weight */
  weight: number;
  /** Health status */
  health_status: HealthStatus;
  /** Last health check timestamp */
  last_health_check: number | null;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * ApiKey entity for client authentication
 * @see prd.md Section 3.2.3
 */
export interface ApiKey {
  /** Unique identifier */
  id: string;
  /** SHA-256 hash of the API key */
  key_hash: string;
  /** Key prefix for display (e.g., 'sk-xxx...') */
  key_prefix: string;
  /** Owner user ID */
  user_id: string;
  /** Company ID */
  company_id: string;
  /** Department ID (optional) */
  department_id: string | null;
  /** Key name/label */
  name: string | null;
  /** Daily quota limit */
  quota_daily: number;
  /** Amount used from daily quota */
  quota_used: number;
  /** Bonus quota amount */
  quota_bonus: number;
  /** Bonus quota expiry timestamp */
  quota_bonus_expiry: number | null;
  /** Whether key has unlimited quota */
  is_unlimited: boolean;
  /** Whether key is active */
  is_active: boolean;
  /** Last quota reset timestamp */
  last_reset_at: number | null;
  /** Last usage timestamp */
  last_used_at: number | null;
  /** Key expiry timestamp */
  expires_at: number | null;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * UsageLog entity for tracking API usage
 * @see prd.md Section 3.2.4
 */
export interface UsageLog {
  /** Unique identifier */
  id: string;
  /** API Key ID */
  api_key_id: string;
  /** User ID */
  user_id: string;
  /** Company ID */
  company_id: string;
  /** Department ID */
  department_id: string | null;
  /** Provider ID */
  provider_id: string;
  /** Model ID */
  model_id: string;
  /** Model name (for query convenience) */
  model_name: string;
  /** API endpoint called */
  endpoint: string;
  /** Input token count (prompt) */
  input_tokens: number;
  /** Output token count (completion) */
  output_tokens: number;
  /** Total token count (input + output) */
  total_tokens: number;
  /** Request status */
  status: RequestStatus;
  /** Error code (if status is 'error') */
  error_code: string | null;
  /** Request ID for tracing */
  request_id: string | null;
  /** Response time in milliseconds */
  response_time_ms: number | null;
  /** Creation timestamp */
  created_at: number;
}

/**
 * QuotaChange entity for auditing quota modifications
 * @see prd.md Section 3.2.4
 */
export interface QuotaChange {
  /** Unique identifier */
  id: string;
  /** Entity type */
  entity_type: EntityType;
  /** Entity ID */
  entity_id: string;
  /** Change type */
  change_type: QuotaChangeType;
  /** Change amount (positive = increase, negative = decrease) */
  change_amount: number;
  /** Previous quota value */
  previous_quota: number;
  /** New quota value */
  new_quota: number;
  /** Reason for change */
  reason: string | null;
  /** User who made the change */
  created_by: string | null;
  /** Creation timestamp */
  created_at: number;
}

// =============================================================================
// DTO Types (API Request/Response)
// =============================================================================

// ---------------------
// Authentication DTOs
// ---------------------

/**
 * Authentication context returned after API key validation
 */
export interface AuthContext {
  /** API Key ID */
  apiKeyId: string;
  /** User ID */
  userId: string;
  /** User email */
  userEmail: string;
  /** User name */
  userName: string | null;
  /** User role */
  userRole: UserRole;
  /** Company ID */
  companyId: string;
  /** Company name */
  companyName: string;
  /** Department ID (if applicable) */
  departmentId: string | null;
  /** Department name (if applicable) */
  departmentName: string | null;
  /** API Key daily quota */
  quotaDaily: number;
  /** API Key quota used */
  quotaUsed: number;
  /** API Key bonus quota */
  quotaBonus: number;
  /** API Key bonus expiry */
  quotaBonusExpiry: number | null;
  /** Whether key has unlimited quota */
  isUnlimited: boolean;
  /** Whether key is active */
  isActive: boolean;
  /** Key expiry timestamp */
  expiresAt: number | null;
}

// ---------------------
// Proxy API DTOs
// ---------------------

/**
 * Anthropic Messages API proxy request
 */
export interface ProxyMessageRequest {
  /** Model identifier */
  model: string;
  /** Message content */
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; text: string }>;
  }>;
  /** Maximum tokens to generate */
  max_tokens: number;
  /** System prompt (optional) */
  system?: string;
  /** Stop sequences (optional) */
  stop_sequences?: string[];
  /** Temperature (optional) */
  temperature?: number;
  /** Top K (optional) */
  top_k?: number;
  /** Top P (optional) */
  top_p?: number;
  /** Stream flag (optional) */
  stream?: boolean;
}

/**
 * Anthropic API usage response
 */
export interface AnthropicUsage {
  /** Input tokens */
  input_tokens: number;
  /** Output tokens */
  output_tokens: number;
}

// ---------------------
// Admin API DTOs - API Keys
// ---------------------

/**
 * Create API Key request DTO
 */
export interface CreateApiKeyDto {
  /** User ID who will own the key */
  user_id: string;
  /** Key name/label */
  name: string;
  /** Daily quota limit */
  quota_daily: number;
  /** Key expiry timestamp (optional) */
  expires_at?: number;
}

/**
 * Update API Key request DTO
 */
export interface UpdateApiKeyDto {
  /** Key name/label */
  name?: string;
  /** Daily quota limit */
  quota_daily?: number;
  /** Whether key is active */
  is_active?: boolean;
  /** Key expiry timestamp */
  expires_at?: number;
}

/**
 * API Key response DTO
 */
export interface ApiKeyResponse {
  /** API Key ID */
  id: string;
  /** Key prefix (for display) */
  key_prefix: string;
  /** Full API key (only returned on creation) */
  key?: string;
  /** Owner user ID */
  user_id: string;
  /** Owner user email */
  user_email: string;
  /** Company ID */
  company_id: string;
  /** Department ID */
  department_id: string | null;
  /** Key name/label */
  name: string | null;
  /** Daily quota limit */
  quota_daily: number;
  /** Quota used */
  quota_used: number;
  /** Bonus quota */
  quota_bonus: number;
  /** Whether key is unlimited */
  is_unlimited: boolean;
  /** Whether key is active */
  is_active: boolean;
  /** Last used timestamp */
  last_used_at: number | null;
  /** Key expiry timestamp */
  expires_at: number | null;
  /** Creation timestamp */
  created_at: number;
}

/**
 * Add bonus quota request DTO
 */
export interface AddBonusQuotaDto {
  /** Bonus amount */
  amount: number;
  /** Bonus expiry timestamp (optional) */
  expires_at?: number;
  /** Reason for bonus */
  reason?: string;
}

// ---------------------
// Admin API DTOs - Providers
// ---------------------

/**
 * Create Provider request DTO
 */
export interface CreateProviderDto {
  /** Provider unique identifier */
  name: string;
  /** Human-readable display name */
  display_name: string;
  /** API endpoint base URL */
  base_url: string;
  /** API version (optional) */
  api_version?: string;
}

/**
 * Update Provider request DTO
 */
export interface UpdateProviderDto {
  /** Human-readable display name */
  display_name?: string;
  /** API endpoint base URL */
  base_url?: string;
  /** API version */
  api_version?: string;
  /** Whether provider is active */
  is_active?: boolean;
}

/**
 * Provider response DTO
 */
export interface ProviderResponse {
  /** Provider ID */
  id: string;
  /** Provider unique identifier */
  name: string;
  /** Human-readable display name */
  display_name: string;
  /** API endpoint base URL */
  base_url: string;
  /** API version */
  api_version: string | null;
  /** Whether provider is active */
  is_active: boolean;
  /** Number of active credentials */
  credential_count: number;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * Add Provider Credential request DTO
 */
export interface AddProviderCredentialDto {
  /** Credential name */
  credential_name: string;
  /** Raw API key (will be encrypted) */
  api_key: string;
  /** Credential priority (optional) */
  priority?: number;
  /** Load balancing weight (optional) */
  weight?: number;
}

/**
 * Provider Credential response DTO
 */
export interface ProviderCredentialResponse {
  /** Credential ID */
  id: string;
  /** Credential name */
  credential_name: string;
  /** Whether credential is active */
  is_active: boolean;
  /** Credential priority */
  priority: number;
  /** Load balancing weight */
  weight: number;
  /** Health status */
  health_status: HealthStatus;
  /** Last health check timestamp */
  last_health_check: number | null;
  /** Creation timestamp */
  created_at: number;
}

// ---------------------
// Admin API DTOs - Models
// ---------------------

/**
 * Create Model request DTO
 */
export interface CreateModelDto {
  /** Model unique identifier */
  model_id: string;
  /** Human-readable display name */
  display_name: string;
  /** Context window size */
  context_window?: number;
  /** Maximum output tokens */
  max_tokens?: number;
}

/**
 * Update Model request DTO
 */
export interface UpdateModelDto {
  /** Human-readable display name */
  display_name?: string;
  /** Context window size */
  context_window?: number;
  /** Maximum output tokens */
  max_tokens?: number;
  /** Whether model is active */
  is_active?: boolean;
}

/**
 * Model response DTO
 */
export interface ModelResponse {
  /** Model ID */
  id: string;
  /** Model unique identifier */
  model_id: string;
  /** Human-readable display name */
  display_name: string;
  /** Context window size */
  context_window: number;
  /** Maximum output tokens */
  max_tokens: number;
  /** Whether model is active */
  is_active: boolean;
  /** Available providers */
  providers: Array<{
    provider_id: string;
    provider_name: string;
    input_price: number;
    output_price: number;
    priority: number;
  }>;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * Link Model to Provider request DTO
 */
export interface LinkModelProviderDto {
  /** Provider ID */
  provider_id: string;
  /** Input price per 1K tokens */
  input_price: number;
  /** Output price per 1K tokens */
  output_price: number;
  /** Provider priority (optional) */
  priority?: number;
}

// ---------------------
// Admin API DTOs - Statistics
// ---------------------

/**
 * Usage stats query parameters
 */
export interface UsageStatsQuery {
  /** Start timestamp (inclusive) */
  start_at: number;
  /** End timestamp (exclusive) */
  end_at: number;
  /** Group by dimension ('day' | 'model' | 'user' | 'department') */
  group_by?: 'day' | 'model' | 'user' | 'department';
  /** Company ID filter (optional) */
  company_id?: string;
  /** Department ID filter (optional) */
  department_id?: string;
  /** User ID filter (optional) */
  user_id?: string;
  /** Model ID filter (optional) */
  model_id?: string;
}

/**
 * Usage stats response DTO
 */
export interface UsageStatsResponse {
  /** Total requests */
  total_requests: number;
  /** Successful requests */
  successful_requests: number;
  /** Failed requests */
  failed_requests: number;
  /** Total input tokens */
  input_tokens: number;
  /** Total output tokens */
  total_output_tokens: number;
  /** Total tokens */
  total_tokens: number;
  /** Estimated cost (USD) */
  estimated_cost: number;
  /** Grouped statistics */
  grouped: Array<{
    /** Group key (depends on group_by) */
    key: string;
    /** Request count */
    requests: number;
    /** Token count */
    tokens: number;
    /** Cost */
    cost: number;
  }>;
}

/**
 * Token usage summary response (simplified version)
 */
export interface TokenUsageSummaryResponse {
  /** Total tokens used */
  total_tokens: number;
  /** Input tokens */
  input_tokens: number;
  /** Output tokens */
  output_tokens: number;
  /** Breakdown by model */
  by_model: Array<{
    model_id: string;
    model_name: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    requests: number;
  }>;
}

/**
 * Cost analysis response
 */
export interface CostAnalysisResponse {
  /** Total cost (USD) */
  total_cost: number;
  /** Cost by model */
  by_model: Array<{
    model_id: string;
    model_name: string;
    input_cost: number;
    output_cost: number;
    total_cost: number;
  }>;
  /** Cost by provider */
  by_provider: Array<{
    provider_id: string;
    provider_name: string;
    total_cost: number;
  }>;
}

/**
 * Model usage statistics response
 */
export interface ModelStatsResponse {
  /** Model ID */
  model_id: string;
  /** Model name */
  model_name: string;
  /** Request count */
  request_count: number;
  /** Total tokens */
  total_tokens: number;
  /** Average tokens per request */
  avg_tokens_per_request: number;
  /** Success rate */
  success_rate: number;
  /** Average response time (ms) */
  avg_response_time_ms: number;
}

// ---------------------
// Admin API DTOs - Quotas
// ---------------------

/**
 * Quota entity for displaying current quota status
 */
export interface QuotaInfo {
  /** Entity type */
  entity_type: EntityType;
  /** Entity ID */
  entity_id: string;
  /** Entity name */
  entity_name: string;
  /** Quota pool limit */
  quota_pool: number;
  /** Quota pool used */
  quota_used: number;
  /** Daily quota limit */
  quota_daily: number;
  /** Daily quota used */
  daily_used: number;
  /** Last reset timestamp */
  last_reset_at: number | null;
}

/**
 * Update quota request DTO
 */
export interface UpdateQuotaDto {
  /** Quota type to update ('pool' | 'daily') */
  quota_type: 'pool' | 'daily';
  /** New quota value */
  quota_value: number;
  /** Reason for change */
  reason?: string;
}

/**
 * Quota update response
 */
export interface QuotaUpdateResponse {
  /** Previous quota value */
  previous_quota: number;
  /** New quota value */
  new_quota: number;
  /** Change amount */
  change_amount: number;
  /** Change ID for audit */
  change_id: string;
}

// ---------------------
// Admin API DTOs - Users/Companies/Departments
// ---------------------

/**
 * Create User request DTO
 */
export interface CreateUserDto {
  /** User email */
  email: string;
  /** User name */
  name: string;
  /** Company ID */
  company_id: string;
  /** Department ID (optional) */
  department_id?: string;
  /** User role */
  role?: UserRole;
  /** Daily quota limit */
  quota_daily?: number;
}

/**
 * User response DTO
 */
export interface UserResponse {
  /** User ID */
  id: string;
  /** User email */
  email: string;
  /** User name */
  name: string | null;
  /** Company ID */
  company_id: string;
  /** Company name */
  company_name: string;
  /** Department ID */
  department_id: string | null;
  /** Department name */
  department_name: string | null;
  /** User role */
  role: UserRole;
  /** Daily quota limit */
  quota_daily: number;
  /** Quota used */
  quota_used: number;
  /** Whether user is active */
  is_active: boolean;
  /** API Key count */
  api_key_count: number;
  /** Creation timestamp */
  created_at: number;
}

/**
 * Create Company request DTO
 */
export interface CreateCompanyDto {
  /** Company name */
  name: string;
  /** Quota pool limit (optional) */
  quota_pool?: number;
  /** Daily quota limit (optional) */
  quota_daily?: number;
}

/**
 * Company response DTO
 */
export interface CompanyResponse {
  /** Company ID */
  id: string;
  /** Company name */
  name: string;
  /** Quota pool limit */
  quota_pool: number;
  /** Quota pool used */
  quota_used: number;
  /** Daily quota limit */
  quota_daily: number;
  /** Daily quota used */
  daily_used: number;
  /** Last reset timestamp */
  last_reset_at: number | null;
  /** User count */
  user_count: number;
  /** Department count */
  department_count: number;
  /** Creation timestamp */
  created_at: number;
}

/**
 * Create Department request DTO
 */
export interface CreateDepartmentDto {
  /** Company ID */
  company_id: string;
  /** Department name */
  name: string;
  /** Quota pool limit (optional) */
  quota_pool?: number;
  /** Daily quota limit (optional) */
  quota_daily?: number;
}

/**
 * Department response DTO
 */
export interface DepartmentResponse {
  /** Department ID */
  id: string;
  /** Company ID */
  company_id: string;
  /** Company name */
  company_name: string;
  /** Department name */
  name: string;
  /** Quota pool limit */
  quota_pool: number;
  /** Quota pool used */
  quota_used: number;
  /** Daily quota limit */
  quota_daily: number;
  /** Daily quota used */
  daily_used: number;
  /** Last reset timestamp */
  last_reset_at: number | null;
  /** User count */
  user_count: number;
  /** Creation timestamp */
  created_at: number;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Standard error codes for API responses
 */
export enum ErrorCode {
  // Authentication Errors (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  API_KEY_DISABLED = 'API_KEY_DISABLED',
  API_KEY_EXPIRED = 'API_KEY_EXPIRED',

  // Quota Errors (4xx)
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INSUFFICIENT_QUOTA = 'INSUFFICIENT_QUOTA',
  DAILY_QUOTA_EXCEEDED = 'DAILY_QUOTA_EXCEEDED',
  POOL_QUOTA_EXCEEDED = 'POOL_QUOTA_EXCEEDED',

  // Validation Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_MODEL = 'INVALID_MODEL',
  MODEL_NOT_ALLOWED = 'MODEL_NOT_ALLOWED',

  // Resource Errors (4xx)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * Standard API error interface
 */
export interface ApiError {
  /** Error code */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  status: number;
  /** Additional error details (optional) */
  details?: Record<string, unknown>;
  /** Request ID for tracing */
  request_id?: string;
}

/**
 * Error response format for API responses
 */
export interface ErrorResponse {
  /** Error code */
  error: {
    /** Error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details (optional) */
    details?: Record<string, unknown>;
    /** Request ID for tracing */
    request_id?: string;
  };
}

// =============================================================================
// Cloudflare Workers Types
// =============================================================================

/**
 * Cloudflare Workers environment bindings
 * Note: D1Database and KVNamespace are global types from @cloudflare/workers-types
 */
export interface Env {
  /** D1 database binding */
  DB: import('@cloudflare/workers-types').D1Database;
  /** KV namespace for cache */
  KV_CACHE: import('@cloudflare/workers-types').KVNamespace;
  /** Secret for encryption */
  ENCRYPTION_KEY?: string;
  /** Environment configuration */
  ENVIRONMENT: string;
}

/**
 * Extended Request with authentication context
 */
export interface AuthenticatedRequest extends Request {
  /** Authentication context (attached by auth middleware) */
  auth?: AuthContext;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Request context passed through middleware chain
 */
export interface RequestContext {
  /** Original request */
  request: Request;
  /** URL object */
  url: URL;
  /** Authentication context (populated by auth middleware) */
  auth?: AuthContext;
  /** Request ID for tracing */
  requestId: string;
  /** Start timestamp for performance tracking */
  startTime: number;
  /** Additional metadata */
  metadata: Map<string, unknown>;
}

/**
 * Anthropic Messages API complete response
 */
export interface AnthropicMessageResponse {
  /** Response ID */
  id: string;
  /** Response type */
  type: string;
  /** Role */
  role: string;
  /** Content blocks */
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  /** Model used */
  model: string;
  /** Stop reason */
  stop_reason: string;
  /** Stop sequence */
  stop_sequence: string | null;
  /** Token usage */
  usage: AnthropicUsage;
}

/**
 * Usage logs query parameters
 */
export interface UsageLogsQuery {
  /** Start timestamp (optional) */
  start_at?: number;
  /** End timestamp (optional) */
  end_at?: number;
  /** Filter by user ID (optional) */
  user_id?: string;
  /** Filter by company ID (optional) */
  company_id?: string;
  /** Filter by department ID (optional) */
  department_id?: string;
  /** Filter by model ID (optional) */
  model_id?: string;
  /** Filter by API key ID (optional) */
  api_key_id?: string;
  /** Filter by status (optional) */
  status?: RequestStatus;
  /** Page number (default: 1) */
  page?: number;
  /** Page size (default: 50, max: 500) */
  page_size?: number;
}

/**
 * Usage logs response with pagination
 */
export interface UsageLogsResponse {
  /** Total count of logs matching query */
  total: number;
  /** Current page number */
  page: number;
  /** Page size */
  page_size: number;
  /** Total pages */
  total_pages: number;
  /** Logs for current page */
  logs: Array<{
    /** Log ID */
    id: string;
    /** API key ID */
    api_key_id: string;
    /** User email */
    user_email: string;
    /** Company name */
    company_name: string;
    /** Department name (if applicable) */
    department_name: string | null;
    /** Provider name */
    provider_name: string;
    /** Model name */
    model_name: string;
    /** Endpoint */
    endpoint: string;
    /** Input tokens */
    input_tokens: number;
    /** Output tokens */
    output_tokens: number;
    /** Total tokens */
    total_tokens: number;
    /** Status */
    status: RequestStatus;
    /** Error code */
    error_code: string | null;
    /** Request ID */
    request_id: string | null;
    /** Response time (ms) */
    response_time_ms: number | null;
    /** Creation timestamp */
    created_at: number;
  }>;
}

/**
 * Quota summary response with hierarchical data
 */
export interface QuotaSummaryResponse {
  /** Entity type */
  entity_type: EntityType;
  /** Entity ID */
  entity_id: string;
  /** Entity name (if applicable) */
  entity_name: string | null;
  /** Pool quota */
  quota_pool: number;
  /** Pool quota used */
  quota_used: number;
  /** Pool quota remaining */
  quota_remaining: number;
  /** Daily quota */
  quota_daily: number;
  /** Daily quota used */
  daily_used: number;
  /** Daily quota remaining */
  daily_remaining: number;
  /** Last reset timestamp */
  last_reset_at: number | null;
  /** Children quotas (for companies/departments) */
  children?: Array<{
    /** Child entity ID */
    entity_id: string;
    /** Child entity name */
    entity_name: string;
    /** Child type */
    entity_type: EntityType;
    /** Pool quota remaining */
    quota_remaining: number;
    /** Daily quota remaining */
    daily_remaining: number;
  }>;
}

/**
 * Reset quota request DTO
 */
export interface ResetQuotaDto {
  /** Reason for the reset */
  reason?: string;
}

/**
 * Department model permission configuration
 */
export interface SetDepartmentModelDto {
  /** Whether the department can use this model */
  is_allowed: boolean;
  /** Daily quota for this model (default: 0) */
  daily_quota?: number;
}

/**
 * Department model response
 */
export interface DepartmentModelResponse {
  /** Department ID */
  department_id: string;
  /** Department name */
  department_name: string;
  /** Model ID */
  model_id: string;
  /** Model display name */
  model_display_name: string;
  /** Whether allowed */
  is_allowed: boolean;
  /** Daily quota */
  daily_quota: number;
  /** Creation timestamp */
  created_at: number;
}

/**
 * Time period for statistics aggregation
 */
export type StatsPeriod = 'hour' | 'day' | 'week' | 'month';

/**
 * Token usage response with period information
 */
export interface TokenUsageResponse {
  /** Aggregation period */
  period: StatsPeriod;
  /** Start timestamp */
  start_at: number;
  /** End timestamp */
  end_at: number;
  /** Total tokens used */
  total_tokens: number;
  /** Input tokens */
  input_tokens: number;
  /** Output tokens */
  output_tokens: number;
  /** Breakdown by entity */
  by_entity: Array<{
    /** Entity type */
    entity_type: EntityType;
    /** Entity ID */
    entity_id: string;
    /** Entity name (if applicable) */
    entity_name: string | null;
    /** Total tokens */
    total_tokens: number;
    /** Request count */
    request_count: number;
  }>;
}

/**
 * Error detail field for validation errors
 */
export interface ErrorDetail {
  /** Field name */
  field: string;
  /** Error message for this field */
  message: string;
  /** Invalid value (optional) */
  value?: unknown;
}

/**
 * Validation error response with field details
 */
export interface ValidationErrorResponse extends ApiError {
  /** Validation error code */
  code: ErrorCode.VALIDATION_ERROR;
  /** Array of field-specific errors */
  details: {
    /** Field validation errors */
    fields?: ErrorDetail[];
    /** Additional context */
    [key: string]: unknown;
  };
}

/**
 * HTTP status code mapping for error codes
 */
export const ErrorCodeStatus: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.API_KEY_DISABLED]: 401,
  [ErrorCode.API_KEY_EXPIRED]: 401,
  [ErrorCode.QUOTA_EXCEEDED]: 402,
  [ErrorCode.INSUFFICIENT_QUOTA]: 402,
  [ErrorCode.DAILY_QUOTA_EXCEEDED]: 402,
  [ErrorCode.POOL_QUOTA_EXCEEDED]: 402,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_MODEL]: 400,
  [ErrorCode.MODEL_NOT_ALLOWED]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.UPSTREAM_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 500,
};
