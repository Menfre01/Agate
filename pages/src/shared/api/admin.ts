/**
 * Admin API 封装
 */

import { adminApi } from './request'
import type {
  UserResponse,
  CompanyResponse,
  DepartmentResponse,
  ApiKeyResponse,
  CreateApiKeyDto,
  UpdateApiKeyDto,
  AddBonusQuotaDto,
  ProviderResponse,
  CreateProviderDto,
  UpdateProviderDto,
  AddProviderCredentialDto,
  ProviderCredentialResponse,
  ModelResponse,
  CreateModelDto,
  UpdateModelDto,
  AddModelProviderDto,
  ModelProviderResponse,
  UsageStatsResponse,
  TokenUsageResponse,
  CostAnalysisResponse,
  ModelStatsResponse,
  UsageLogsResponse,
  UsageLogsQuery,
  QuotaInfo,
  UpdateQuotaDto,
  QuotaUpdateResponse,
} from '@shared/types/api'

// =============================================================================
// Users API
// =============================================================================

export interface UserListQuery {
  page?: number
  page_size?: number
  company_id?: string
  department_id?: string
  role?: 'admin' | 'user'
  is_active?: boolean
}

export interface UserListResponse {
  total: number
  page: number
  page_size: number
  total_pages: number
  users: UserResponse[]
}

export async function getUsers(query?: UserListQuery): Promise<UserListResponse> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return adminApi.get(`/admin/users?${params.toString()}`)
}

// =============================================================================
// Companies API
// =============================================================================

export interface CompanyListQuery {
  page?: number
  page_size?: number
}

export interface CompanyListResponse {
  total: number
  page: number
  page_size: number
  total_pages: number
  companies: CompanyResponse[]
}

export async function getCompanies(query?: CompanyListQuery): Promise<CompanyListResponse> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return adminApi.get(`/admin/companies?${params.toString()}`)
}

// =============================================================================
// Departments API
// =============================================================================

export interface DepartmentListQuery {
  page?: number
  page_size?: number
  company_id?: string
}

export interface DepartmentListResponse {
  total: number
  page: number
  page_size: number
  total_pages: number
  departments: DepartmentResponse[]
}

export async function getDepartments(query?: DepartmentListQuery): Promise<DepartmentListResponse> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return adminApi.get(`/admin/departments?${params.toString()}`)
}

// =============================================================================
// API Keys API
// =============================================================================

export interface KeyListQuery {
  page?: number
  page_size?: number
  user_id?: string
  company_id?: string
  department_id?: string
  is_active?: boolean
}

export interface KeyListResponse {
  total: number
  page: number
  page_size: number
  total_pages: number
  keys: ApiKeyResponse[]
}

export async function getKeys(query?: KeyListQuery): Promise<KeyListResponse> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return adminApi.get(`/admin/keys?${params.toString()}`)
}

export async function createKey(data: CreateApiKeyDto): Promise<ApiKeyResponse> {
  return adminApi.post('/admin/keys', data)
}

export async function updateKey(id: string, data: UpdateApiKeyDto): Promise<ApiKeyResponse> {
  return adminApi.put(`/admin/keys/${id}`, data)
}

export async function disableKey(id: string): Promise<{ success: boolean }> {
  return adminApi.post(`/admin/keys/${id}/disable`)
}

export async function addBonusQuota(id: string, data: AddBonusQuotaDto): Promise<ApiKeyResponse> {
  return adminApi.post(`/admin/keys/${id}/bonus`, data)
}

// =============================================================================
// Providers API
// =============================================================================

export interface ProviderListResponse {
  total: number
  providers: ProviderResponse[]
}

export async function getProviders(): Promise<ProviderListResponse> {
  return adminApi.get('/admin/providers')
}

export async function createProvider(data: CreateProviderDto): Promise<ProviderResponse> {
  return adminApi.post('/admin/providers', data)
}

export async function updateProvider(id: string, data: UpdateProviderDto): Promise<ProviderResponse> {
  return adminApi.put(`/admin/providers/${id}`, data)
}

export async function deleteProvider(id: string): Promise<{ success: boolean }> {
  return adminApi.delete(`/admin/providers/${id}`)
}

export interface CredentialListResponse {
  credentials: ProviderCredentialResponse[]
}

export async function getProviderCredentials(providerId: string): Promise<CredentialListResponse> {
  return adminApi.get(`/admin/providers/${providerId}/credentials`)
}

export async function addCredential(providerId: string, data: AddProviderCredentialDto): Promise<ProviderCredentialResponse> {
  return adminApi.post(`/admin/providers/${providerId}/credentials`, data)
}

export async function deleteCredential(providerId: string, credentialId: string): Promise<{ success: boolean }> {
  return adminApi.delete(`/admin/providers/${providerId}/credentials/${credentialId}`)
}

// =============================================================================
// Models API
// =============================================================================

export interface ModelListResponse {
  total: number
  models: ModelResponse[]
}

export async function getModels(): Promise<ModelListResponse> {
  return adminApi.get('/admin/models')
}

export async function createModel(data: CreateModelDto): Promise<ModelResponse> {
  return adminApi.post('/admin/models', data)
}

export async function updateModel(id: string, data: UpdateModelDto): Promise<ModelResponse> {
  return adminApi.put(`/admin/models/${id}`, data)
}

export async function deleteModel(id: string): Promise<{ success: boolean }> {
  return adminApi.delete(`/admin/models/${id}`)
}

export async function addModelProvider(modelId: string, data: AddModelProviderDto): Promise<ModelProviderResponse> {
  return adminApi.post(`/admin/models/${modelId}/providers`, data)
}

export async function removeModelProvider(modelId: string, providerId: string): Promise<{ success: boolean }> {
  return adminApi.delete(`/admin/models/${modelId}/providers/${providerId}`)
}

// =============================================================================
// Statistics API
// =============================================================================

export async function getUsageStats(query: {
  start_at: number
  end_at: number
  group_by?: 'day' | 'model' | 'user' | 'department'
  company_id?: string
  department_id?: string
  user_id?: string
  model_id?: string
}): Promise<UsageStatsResponse> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value))
    }
  })
  return adminApi.get(`/admin/stats/usage?${params.toString()}`)
}

export async function getTokenUsage(query?: {
  period?: 'hour' | 'day' | 'week' | 'month'
  company_id?: string
  department_id?: string
  user_id?: string
}): Promise<TokenUsageResponse> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return adminApi.get(`/admin/stats/tokens?${params.toString()}`)
}

export async function getCostAnalysis(query?: {
  start_at?: number
  end_at?: number
  company_id?: string
}): Promise<CostAnalysisResponse> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return adminApi.get(`/admin/stats/costs?${params.toString()}`)
}

export async function getModelStats(query?: {
  start_at?: number
  end_at?: number
  company_id?: string
}): Promise<{ stats: ModelStatsResponse[] }> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return adminApi.get(`/admin/stats/models?${params.toString()}`)
}

export async function getLogs(query: UsageLogsQuery): Promise<UsageLogsResponse> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value))
    }
  })
  return adminApi.get(`/admin/logs?${params.toString()}`)
}

// =============================================================================
// Quotas API
// =============================================================================

export interface QuotaListQuery {
  entity_type: 'api_key' | 'department' | 'company'
  entity_id?: string
}

export interface QuotaListResponse {
  quotas: QuotaInfo[]
}

export async function getQuotas(query: QuotaListQuery): Promise<QuotaListResponse> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value))
    }
  })
  return adminApi.get(`/admin/quotas?${params.toString()}`)
}

export async function updateQuota(
  entityType: 'api_key' | 'department' | 'company',
  entityId: string,
  data: UpdateQuotaDto
): Promise<QuotaUpdateResponse> {
  return adminApi.put(`/admin/quotas/${entityType}/${entityId}`, data)
}

export async function resetQuota(
  entityType: 'api_key' | 'department' | 'company',
  entityId: string,
  data?: { reason?: string }
): Promise<QuotaUpdateResponse> {
  return adminApi.post(`/admin/quotas/${entityType}/${entityId}/reset`, data)
}
