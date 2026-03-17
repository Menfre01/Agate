/**
 * API 客户端封装
 *
 * 统一的 HTTP 请求封装，用于功能测试
 *
 * @module tests/functional/helpers/api-client
 */

import type { Env } from "@/types/index.js";
import type {
  CreateCompanyDto,
  CreateDepartmentDto,
  CreateUserDto,
  CreateApiKeyDto,
  CreateProviderDto,
  CreateModelDto,
  UpdateApiKeyDto,
  UpdateProviderDto,
  UpdateModelDto,
  AddModelProviderDto,
  AddProviderCredentialDto,
  AddBonusQuotaDto,
  SetDepartmentModelDto,
} from "@/types/index.js";

/**
 * API 响应包装器
 */
export interface ApiResponse<T = unknown> {
  status: number;
  data: T | null;
  error: string | null;
  headers: Headers;
}

/**
 * API 客户端类
 */
export class ApiClient {
  private adminBaseUrl: string;
  private proxyBaseUrl: string;
  private defaultApiKey: string;

  constructor(adminBaseUrl: string, proxyBaseUrl: string, adminApiKey: string) {
    this.adminBaseUrl = adminBaseUrl;
    this.proxyBaseUrl = proxyBaseUrl;
    this.defaultApiKey = adminApiKey;
  }

  /**
   * 根据端点选择合适的 base URL
   */
  private getBaseUrl(endpoint: string): string {
    if (endpoint.startsWith("/v1/")) {
      return this.proxyBaseUrl;
    }
    return this.adminBaseUrl;
  }

  // ========================================
  // 通用请求方法
  // ========================================

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    apiKey?: string
  ): Promise<ApiResponse<T>> {
    const baseUrl = this.getBaseUrl(endpoint);
    const url = `${baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : null;

      return {
        status: response.status,
        data,
        error: data?.error?.message ?? null,
        headers: response.headers,
      };
    } catch (error) {
      return {
        status: 0,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        headers: new Headers(),
      };
    }
  }

  async get<T>(endpoint: string, apiKey?: string): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint, undefined, apiKey ?? this.defaultApiKey);
  }

  async post<T>(endpoint: string, body: unknown, apiKey?: string): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, body, apiKey ?? this.defaultApiKey);
  }

  async put<T>(endpoint: string, body: unknown, apiKey?: string): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, body, apiKey ?? this.defaultApiKey);
  }

  async delete<T>(endpoint: string, apiKey?: string): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint, undefined, apiKey ?? this.defaultApiKey);
  }

  // ========================================
  // Companies API
  // ========================================

  async listCompanies(): Promise<ApiResponse> {
    return this.get("/admin/companies");
  }

  async createCompany(dto: CreateCompanyDto): Promise<ApiResponse> {
    return this.post("/admin/companies", dto);
  }

  async getCompany(id: string): Promise<ApiResponse> {
    return this.get(`/admin/companies/${id}`);
  }

  async updateCompany(id: string, dto: Partial<CreateCompanyDto>): Promise<ApiResponse> {
    return this.put(`/admin/companies/${id}`, dto);
  }

  async deleteCompany(id: string): Promise<ApiResponse> {
    return this.delete(`/admin/companies/${id}`);
  }

  // ========================================
  // Departments API
  // ========================================

  async listDepartments(params?: { company_id?: string }): Promise<ApiResponse> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    return this.get(`/admin/departments${qs}`);
  }

  async createDepartment(dto: CreateDepartmentDto): Promise<ApiResponse> {
    return this.post("/admin/departments", dto);
  }

  async getDepartment(id: string): Promise<ApiResponse> {
    return this.get(`/admin/departments/${id}`);
  }

  async updateDepartment(id: string, dto: Partial<CreateDepartmentDto>): Promise<ApiResponse> {
    return this.put(`/admin/departments/${id}`, dto);
  }

  async deleteDepartment(id: string): Promise<ApiResponse> {
    return this.delete(`/admin/departments/${id}`);
  }

  // ========================================
  // Users API
  // ========================================

  async listUsers(params?: { company_id?: string; department_id?: string }): Promise<ApiResponse> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    return this.get(`/admin/users${qs}`);
  }

  async createUser(dto: CreateUserDto): Promise<ApiResponse> {
    return this.post("/admin/users", dto);
  }

  async getUser(id: string): Promise<ApiResponse> {
    return this.get(`/admin/users/${id}`);
  }

  async updateUser(id: string, dto: Partial<CreateUserDto>): Promise<ApiResponse> {
    return this.put(`/admin/users/${id}`, dto);
  }

  async deleteUser(id: string): Promise<ApiResponse> {
    return this.delete(`/admin/users/${id}`);
  }

  // ========================================
  // API Keys API
  // ========================================

  async listApiKeys(params?: {
    user_id?: string;
    company_id?: string;
    status?: string;
  }): Promise<ApiResponse> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    return this.get(`/admin/keys${qs}`);
  }

  async createApiKey(dto: CreateApiKeyDto): Promise<ApiResponse> {
    return this.post("/admin/keys", dto);
  }

  async getApiKey(id: string): Promise<ApiResponse> {
    return this.get(`/admin/keys/${id}`);
  }

  async updateApiKey(id: string, dto: UpdateApiKeyDto): Promise<ApiResponse> {
    return this.put(`/admin/keys/${id}`, dto);
  }

  async deleteApiKey(id: string): Promise<ApiResponse> {
    return this.delete(`/admin/keys/${id}`);
  }

  async disableApiKey(id: string): Promise<ApiResponse> {
    return this.post(`/admin/keys/${id}/disable`, {});
  }

  async enableApiKey(id: string): Promise<ApiResponse> {
    return this.post(`/admin/keys/${id}/enable`, {});
  }

  async addBonusQuota(id: string, dto: AddBonusQuotaDto): Promise<ApiResponse> {
    return this.post(`/admin/keys/${id}/bonus`, dto);
  }

  // ========================================
  // Providers API
  // ========================================

  async listProviders(): Promise<ApiResponse> {
    return this.get("/admin/providers");
  }

  async createProvider(dto: CreateProviderDto): Promise<ApiResponse> {
    return this.post("/admin/providers", dto);
  }

  async getProvider(id: string): Promise<ApiResponse> {
    return this.get(`/admin/providers/${id}`);
  }

  async updateProvider(id: string, dto: UpdateProviderDto): Promise<ApiResponse> {
    return this.put(`/admin/providers/${id}`, dto);
  }

  async deleteProvider(id: string): Promise<ApiResponse> {
    return this.delete(`/admin/providers/${id}`);
  }

  async addProviderCredential(providerId: string, dto: AddProviderCredentialDto): Promise<ApiResponse> {
    return this.post(`/admin/providers/${providerId}/credentials`, dto);
  }

  async deleteProviderCredential(credentialId: string): Promise<ApiResponse> {
    return this.delete(`/admin/providers/credentials/${credentialId}`);
  }

  // ========================================
  // Models API
  // ========================================

  async listModels(): Promise<ApiResponse> {
    return this.get("/admin/models");
  }

  async createModel(dto: CreateModelDto): Promise<ApiResponse> {
    return this.post("/admin/models", dto);
  }

  async getModel(id: string): Promise<ApiResponse> {
    return this.get(`/admin/models/${id}`);
  }

  async updateModel(id: string, dto: UpdateModelDto): Promise<ApiResponse> {
    return this.put(`/admin/models/${id}`, dto);
  }

  async deleteModel(id: string): Promise<ApiResponse> {
    return this.delete(`/admin/models/${id}`);
  }

  /**
   * 添加供应商到模型 (n:n 关系)
   */
  async addModelProvider(modelId: string, dto: {
    provider_id: string;
    input_price?: number;
    output_price?: number;
  }): Promise<ApiResponse> {
    return this.post(`/admin/models/${modelId}/providers`, dto);
  }

  /**
   * 从模型移除供应商
   */
  async removeModelProvider(modelId: string, providerId: string): Promise<ApiResponse> {
    return this.delete(`/admin/models/${modelId}/providers/${providerId}`);
  }

  /**
   * 列出模型的所有供应商
   */
  async listModelProviders(modelId: string): Promise<ApiResponse> {
    return this.get(`/admin/models/${modelId}/providers`);
  }

  async setDepartmentModel(departmentId: string, modelId: string, dto: SetDepartmentModelDto): Promise<ApiResponse> {
    return this.post(`/admin/departments/${departmentId}/models`, {
      model_id: modelId,
      ...dto,
    });
  }

  // ========================================
  // Stats API
  // ========================================

  async getUsageStats(params: {
    start_at: number;
    end_at: number;
    group_by?: string;
  }): Promise<ApiResponse> {
    const qs = `?${new URLSearchParams(params as Record<string, string>)}`;
    return this.get(`/admin/stats/usage${qs}`);
  }

  async getTokenUsage(params: {
    start_at: number;
    end_at: number;
  }): Promise<ApiResponse> {
    const qs = `?${new URLSearchParams(params as Record<string, string>)}`;
    return this.get(`/admin/stats/tokens${qs}`);
  }

  async getCostAnalysis(params: {
    start_at: number;
    end_at: number;
  }): Promise<ApiResponse> {
    const qs = `?${new URLSearchParams(params as Record<string, string>)}`;
    return this.get(`/admin/stats/costs${qs}`);
  }

  async getModelStats(params: {
    start_at: number;
    end_at: number;
  }): Promise<ApiResponse> {
    const qs = `?${new URLSearchParams(params as Record<string, string>)}`;
    return this.get(`/admin/stats/models${qs}`);
  }

  async getUsageLogs(params: {
    start_at?: number;
    end_at?: number;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse> {
    const qs = `?${new URLSearchParams(params as Record<string, string>)}`;
    return this.get(`/admin/logs${qs}`);
  }

  // ========================================
  // Quotas API
  // ========================================

  async listQuotas(params?: {
    entity_type?: string;
  }): Promise<ApiResponse> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    return this.get(`/admin/quotas${qs}`);
  }

  async updateQuota(entityType: string, entityId: string, dto: {
    quota_type: "pool" | "daily";
    quota_value: number;
  }): Promise<ApiResponse> {
    return this.put(`/admin/quotas/${entityType}/${entityId}`, dto);
  }

  async resetQuota(entityType: string, entityId: string): Promise<ApiResponse> {
    return this.post(`/admin/quotas/${entityType}/${entityId}/reset`, {});
  }

  async addBonus(entityType: string, entityId: string, dto: AddBonusQuotaDto): Promise<ApiResponse> {
    return this.post(`/admin/quotas/${entityType}/${entityId}/bonus`, dto);
  }

  // ========================================
  // Proxy API
  // ========================================

  async proxyGetModels(apiKey: string): Promise<ApiResponse> {
    return this.get("/v1/models", apiKey);
  }

  async proxyCreateMessage(apiKey: string, body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens: number;
    stream?: boolean;
  }): Promise<ApiResponse> {
    return this.post("/v1/messages", body, apiKey);
  }
}
