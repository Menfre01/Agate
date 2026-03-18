/**
 * Shared API Type Definitions
 *
 * These types are shared between frontend and backend for type safety.
 * Exported from src/types/index.ts and used by the frontend admin panel.
 */

// =============================================================================
// Entity Types
// =============================================================================

/**
 * User role enumeration
 */
export type UserRole = 'admin' | 'user';

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
 * Time period for statistics aggregation
 */
export type StatsPeriod = 'hour' | 'day' | 'week' | 'month';

// =============================================================================
// DTO Types - Authentication
// =============================================================================

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

// =============================================================================
// DTO Types - API Keys
// =============================================================================

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

// =============================================================================
// DTO Types - Providers
// =============================================================================

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
  /** Custom base URL (optional, falls back to provider's base_url) */
  base_url?: string;
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
  /** Custom base URL (null if using provider's default) */
  base_url: string | null;
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

// =============================================================================
// DTO Types - Models
// =============================================================================

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
  /** Available providers for this model */
  providers: Array<{
    /** Provider ID */
    provider_id: string;
    /** Provider name */
    provider_name: string;
    /** Input price per 1K tokens */
    input_price: number;
    /** Output price per 1K tokens */
    output_price: number;
    /** Whether this provider is active for this model */
    is_active: boolean;
  }>;
  /** Creation timestamp */
  created_at: number;
  /** Last update timestamp */
  updated_at: number;
}

/**
 * Add Provider to Model request DTO
 */
export interface AddModelProviderDto {
  /** Provider ID */
  provider_id: string;
  /** Input price per 1K tokens */
  input_price?: number;
  /** Output price per 1K tokens */
  output_price?: number;
}

/**
 * Model-Provider response DTO
 */
export interface ModelProviderResponse {
  /** Model ID */
  model_id: string;
  /** Provider ID */
  provider_id: string;
  /** Provider name */
  provider_name: string;
  /** Input price per 1K tokens */
  input_price: number;
  /** Output price per 1K tokens */
  output_price: number;
  /** Whether this provider is active for this model */
  is_active: boolean;
}

// =============================================================================
// DTO Types - Statistics
// =============================================================================

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

// =============================================================================
// DTO Types - Quotas
// =============================================================================

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

// =============================================================================
// DTO Types - Users/Companies/Departments
// =============================================================================

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

// =============================================================================
// DTO Types - Usage Logs
// =============================================================================

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
