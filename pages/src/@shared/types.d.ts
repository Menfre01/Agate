// Type declarations for @shared/types
// Re-declaring types from packages/shared/src/types for Pages project

// Types enum
export type EntityType = 'api_key' | 'department' | 'company'
export type UserRole = 'admin' | 'user' | 'system'
export type StatsPeriod = 'hour' | 'day' | 'week' | 'month'

// AuthContext from packages/shared/src/types/index.ts
export interface AuthContext {
  /** API Key ID */
  apiKeyId: string
  /** User ID */
  userId: string
  /** User email */
  userEmail: string
  /** User name */
  userName: string | null
  /** User role */
  userRole: UserRole
  /** Company ID */
  companyId: string
  /** Company name */
  companyName: string
  /** Department ID (if applicable) */
  departmentId: string | null
  /** Department name (if applicable) */
  departmentName: string | null
  /** API Key daily quota */
  quotaDaily: number
  /** API Key quota used */
  quotaUsed: number
  /** API Key bonus quota */
  quotaBonus: number
  /** API Key bonus expiry */
  quotaBonusExpiry: number | null
  /** Whether key has unlimited quota */
  isUnlimited: boolean
  /** Whether key is active */
  isActive: boolean
  /** Key expiry timestamp */
  expiresAt: number | null
}

// API Key Response
export interface ApiKeyResponse {
  id: string
  key_prefix: string
  key?: string
  user_id: string
  user_email: string
  company_id: string
  department_id: string | null
  name: string | null
  quota_daily: number
  quota_used: number
  quota_bonus: number
  quota_bonus_used: number
  is_unlimited: boolean
  is_active: boolean
  last_used_at: number | null
  expires_at: number | null
  created_at: number
}

// User Response
export interface UserResponse {
  id: string
  email: string
  name: string | null
  company_id: string
  company_name: string
  department_id: string | null
  department_name: string | null
  role: UserRole
  quota_daily: number
  quota_used: number
  is_active: boolean
  is_unlimited: boolean
  api_key_count: number
  created_at: number
  updated_at: number
}

// Company Response
export interface CompanyResponse {
  id: string
  name: string
  quota_pool: number
  quota_used: number
  quota_daily: number
  daily_used: number
  last_reset_at: number | null
  created_at: number
  updated_at: number
}

// Department Response
export interface DepartmentResponse {
  id: string
  name: string
  company_id: string
  quota_pool: number
  quota_used: number
  created_at: number
  updated_at: number
}

// Provider Response
export interface ProviderResponse {
  id: string
  name: string
  display_name: string
  base_url: string
  api_version: string | null
  is_active: boolean
  created_at: number
  updated_at: number
}

// Provider Credential Response
export interface ProviderCredentialResponse {
  id: string
  provider_id: string
  name: string
  api_key: string
  is_active: boolean
  created_at: number
  updated_at: number
}

// Model Response
export interface ModelResponse {
  id: string
  model_id: string
  alias: string | null
  display_name: string
  context_window: number
  max_tokens: number
  is_active: boolean
  providers: Array<{
    provider_id: string
    provider_name: string
    input_price: number
    output_price: number
    is_active: boolean
  }>
  created_at: number
  updated_at: number
}

// Model Provider Response
export interface ModelProviderResponse {
  model_id: string
  provider_id: string
  provider_name: string
  input_price: number
  output_price: number
  is_active: boolean
}

// Usage Stats Response
export interface UsageStatsResponse {
  total_requests: number
  successful_requests: number
  failed_requests: number
  input_tokens: number
  total_output_tokens: number
  total_tokens: number
  estimated_cost: number
  grouped: Array<{
    key: string
    requests: number
    tokens: number
    cost: number
  }>
}

// Token Usage Response
export interface TokenUsageResponse {
  period: StatsPeriod
  start_at: number
  end_at: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  by_entity: Array<{
    entity_type: EntityType
    entity_id: string
    entity_name: string | null
    total_tokens: number
    request_count: number
  }>
}

// Token Usage Summary Response
export interface TokenUsageSummaryResponse {
  total_tokens: number
  input_tokens: number
  output_tokens: number
  by_model: Array<{
    model_id: string
    model_name: string
    input_tokens: number
    output_tokens: number
    total_tokens: number
    requests: number
  }>
}

// Cost Analysis Response
export interface CostAnalysisResponse {
  total_cost: number
  by_model: Array<{
    model_id: string
    model_name: string
    input_cost: number
    output_cost: number
    total_cost: number
  }>
  by_provider: Array<{
    provider_id: string
    provider_name: string
    total_cost: number
  }>
}

// Model Stats Response
export interface ModelStatsResponse {
  model_id: string
  model_name: string
  total_requests: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  total_cost: number
}

// Provider Model Stats Response
export interface ProviderModelStatsResponse {
  provider_id: string
  provider_name: string
  model_id: string
  model_name: string
  request_count: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

// Usage Logs Response
export interface UsageLogsResponse {
  total: number
  page: number
  page_size: number
  total_pages: number
  logs: Array<{
    id: string
    api_key_id: string
    user_id: string
    company_id: string
    department_id: string | null
    model_id: string
    provider_id: string
    model_name: string
    input_tokens: number
    output_tokens: number
    total_tokens: number
    cost: number
    status: string
    error_message: string | null
    created_at: number
  }>
}

// Usage Logs Query
export interface UsageLogsQuery {
  start_at?: number
  end_at?: number
  page?: number
  page_size?: number
  company_id?: string
  department_id?: string
  user_id?: string
  model_id?: string
  provider_id?: string
  status?: string
}

// Quota Info
export interface QuotaInfo {
  entity_type: EntityType
  entity_id: string
  entity_name: string
  quota_pool: number
  quota_used: number
  quota_daily: number
  daily_used: number
  last_reset_at: number | null
}

// Quota Update Response
export interface QuotaUpdateResponse {
  previous_quota: number
  new_quota: number
  change_amount: number
  change_id: string
}

// DTOs
export interface CreateApiKeyDto {
  user_id: string
  name: string
  quota_daily?: number
  is_unlimited?: boolean
  company_id?: string
  department_id?: string
}

export interface UpdateApiKeyDto {
  name?: string
  quota_daily?: number
  is_unlimited?: boolean
  is_active?: boolean
}

export interface AddBonusQuotaDto {
  amount: number
  expires_at?: number
  reason?: string
}

export interface CreateProviderDto {
  name: string
  display_name: string
  base_url: string
  api_version?: string
}

export interface UpdateProviderDto {
  display_name?: string
  base_url?: string
  api_version?: string
  is_active?: boolean
}

export interface AddProviderCredentialDto {
  credential_name: string
  api_key: string
  base_url?: string
  priority?: number
  weight?: number
}

export interface CreateModelDto {
  model_id: string
  alias?: string
  display_name: string
  context_window?: number
  max_tokens?: number
}

export interface UpdateModelDto {
  alias?: string | null
  display_name?: string
  context_window?: number
  max_tokens?: number
  is_active?: boolean
}

export interface AddModelProviderDto {
  provider_id: string
  input_price?: number
  output_price?: number
}

export interface UpdateQuotaDto {
  quota_type: 'pool' | 'daily'
  quota_value: number
  reason?: string
}
