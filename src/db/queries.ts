/**
 * Database Query Layer for AI Gateway
 *
 * Provides CRUD operations for all entities using prepared statements
 * to prevent SQL injection. Compatible with Cloudflare D1 (SQLite).
 *
 * @module db/queries
 */


// ============================================
// Type Definitions
// ============================================

/**
 * Company entity representing an organization
 */
export interface Company {
  id: string;
  name: string;
  quota_pool: number;
  quota_used: number;
  quota_daily: number;
  daily_used: number;
  last_reset_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * Department entity representing a subdivision of a company
 */
export interface Department {
  id: string;
  company_id: string;
  name: string;
  quota_pool: number;
  quota_used: number;
  quota_daily: number;
  daily_used: number;
  last_reset_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * User entity representing an individual user
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  company_id: string;
  department_id: string | null;
  role: string;
  quota_daily: number;
  quota_used: number;
  is_active: boolean;
  last_reset_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * Provider entity representing an AI API provider
 */
export interface Provider {
  id: string;
  name: string;
  display_name: string;
  base_url: string;
  api_version: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * Model entity representing an AI model
 */
export interface Model {
  id: string;
  model_id: string;
  display_name: string;
  context_window: number;
  max_tokens: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * ModelProvider association entity
 */
export interface ModelProvider {
  id: string;
  model_id: string;
  provider_id: string;
  input_price: number;
  output_price: number;
  priority: number;
  is_active: boolean;
  created_at: number;
}

/**
 * DepartmentModel configuration entity
 */
export interface DepartmentModel {
  id: string;
  department_id: string;
  model_id: string;
  is_allowed: boolean;
  daily_quota: number;
  created_at: number;
}

/**
 * ApiKey entity for authentication
 */
export interface ApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  user_id: string;
  company_id: string;
  department_id: string | null;
  name: string | null;
  quota_daily: number;
  quota_used: number;
  quota_bonus: number;
  quota_bonus_expiry: number | null;
  is_unlimited: boolean;
  is_active: boolean;
  last_reset_at: number | null;
  last_used_at: number | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * ProviderCredential entity for storing encrypted API keys
 */
export interface ProviderCredential {
  id: string;
  provider_id: string;
  credential_name: string;
  api_key_encrypted: string;
  is_active: boolean;
  priority: number;
  weight: number;
  health_status: string;
  last_health_check: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * UsageLog entity for tracking API usage
 */
export interface UsageLog {
  id: string;
  api_key_id: string;
  user_id: string;
  company_id: string;
  department_id: string | null;
  provider_id: string;
  model_id: string;
  model_name: string;
  endpoint: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  status: string;
  error_code: string | null;
  request_id: string | null;
  response_time_ms: number | null;
  created_at: number;
}

/**
 * QuotaChange entity for tracking quota modifications
 */
export interface QuotaChange {
  id: string;
  entity_type: string;
  entity_id: string;
  change_type: string;
  change_amount: number;
  previous_quota: number;
  new_quota: number;
  reason: string | null;
  created_by: string | null;
  created_at: number;
}

// ============================================
// DTO Types for Create/Update Operations
// ============================================

export interface CreateCompanyDto {
  id: string;
  name: string;
  quota_pool?: number;
  quota_daily?: number;
}

export interface UpdateCompanyDto {
  name?: string;
  quota_pool?: number;
  quota_daily?: number;
}

export interface CreateDepartmentDto {
  id: string;
  company_id: string;
  name: string;
  quota_pool?: number;
  quota_daily?: number;
}

export interface UpdateDepartmentDto {
  name?: string;
  quota_pool?: number;
  quota_daily?: number;
}

export interface CreateUserDto {
  id: string;
  email: string;
  name?: string;
  company_id: string;
  department_id?: string;
  role?: string;
  quota_daily?: number;
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
  department_id?: string;
  role?: string;
  quota_daily?: number;
  is_active?: boolean;
}

export interface CreateProviderDto {
  id: string;
  name: string;
  display_name: string;
  base_url: string;
  api_version?: string;
}

export interface UpdateProviderDto {
  display_name?: string;
  base_url?: string;
  api_version?: string;
  is_active?: boolean;
}

export interface CreateModelDto {
  id: string;
  model_id: string;
  display_name: string;
  context_window?: number;
  max_tokens?: number;
}

export interface UpdateModelDto {
  display_name?: string;
  context_window?: number;
  max_tokens?: number;
  is_active?: boolean;
}

export interface CreateApiKeyDto {
  id: string;
  key_hash: string;
  key_prefix: string;
  user_id: string;
  company_id: string;
  department_id?: string;
  name?: string;
  quota_daily?: number;
  is_unlimited?: boolean;
  expires_at?: number;
}

export interface UpdateApiKeyDto {
  name?: string;
  quota_daily?: number;
  is_unlimited?: boolean;
  is_active?: boolean;
  expires_at?: string;
}

export interface CreateUsageLogDto {
  id: string;
  api_key_id: string;
  user_id: string;
  company_id: string;
  department_id: string | null;
  provider_id: string;
  model_id: string;
  model_name: string;
  endpoint: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  status: string;
  error_code?: string;
  request_id?: string;
  response_time_ms?: number;
}

export interface QuotaChangeDto {
  id: string;
  entity_type: string;
  entity_id: string;
  change_type: string;
  change_amount: number;
  previous_quota: number;
  new_quota: number;
  reason?: string;
  created_by?: string;
}

// ============================================
// Database Interface Extension
// ============================================

/**
 * Extended D1 Database interface with our query methods
 */
export interface Database extends D1Database {
  prepare(query: string): D1PreparedStatement;
}

// ============================================
// Queries Class
// ============================================

/**
 * Database queries encapsulation class
 *
 * Provides type-safe CRUD operations for all entities.
 * All queries use prepared statements to prevent SQL injection.
 *
 * @example
 * ```ts
 * const queries = new Queries(env.DB);
 * const company = await queries.getCompany('comp_123');
 * ```
 */
export class Queries {
  constructor(private db: D1Database) {}

  // ============================================
  // Company CRUD Operations
  // ============================================

  /**
   * Retrieve a company by ID
   *
   * @param id - Company ID
   * @returns Company object or null if not found
   */
  async getCompany(id: string): Promise<Company | null> {
    const result = await this.db
      .prepare('SELECT * FROM companies WHERE id = ?1')
      .bind(id)
      .first<Company>();
    return result || null;
  }

  /**
   * Retrieve a company by name
   *
   * @param name - Company name
   * @returns Company object or null if not found
   */
  async getCompanyByName(name: string): Promise<Company | null> {
    const result = await this.db
      .prepare('SELECT * FROM companies WHERE name = ?1')
      .bind(name)
      .first<Company>();
    return result || null;
  }

  /**
   * Create a new company
   *
   * @param data - Company creation data
   * @returns Created company object
   */
  async createCompany(data: CreateCompanyDto): Promise<Company> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO companies (
          id, name, quota_pool, quota_used, quota_daily, daily_used,
          last_reset_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      )
      .bind(
        data.id,
        data.name,
        data.quota_pool ?? 0,
        0,
        data.quota_daily ?? 0,
        0,
        null,
        now,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to create company: ${result.error}`);
    }

    return this.getCompany(data.id) as Promise<Company>;
  }

  /**
   * Update an existing company
   *
   * @param id - Company ID
   * @param data - Company update data
   * @returns Updated company object
   */
  async updateCompany(id: string, data: UpdateCompanyDto): Promise<Company> {
    const updates: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = ?${paramIndex++}`);
      params.push(data.name);
    }
    if (data.quota_pool !== undefined) {
      updates.push(`quota_pool = ?${paramIndex++}`);
      params.push(data.quota_pool);
    }
    if (data.quota_daily !== undefined) {
      updates.push(`quota_daily = ?${paramIndex++}`);
      params.push(data.quota_daily);
    }

    updates.push(`updated_at = ?${paramIndex++}`);
    params.push(Date.now());
    params.push(id);

    const query = `UPDATE companies SET ${updates.join(', ')} WHERE id = ?${paramIndex}`;
    const result = await this.db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error(`Failed to update company: ${result.error}`);
    }

    return this.getCompany(id) as Promise<Company>;
  }

  /**
   * List all companies
   *
   * @returns Array of all companies
   */
  async listCompanies(): Promise<Company[]> {
    const result = await this.db
      .prepare('SELECT * FROM companies ORDER BY created_at DESC')
      .all<Company>();
    return result.results;
  }

  /**
   * Delete a company by ID
   *
   * @param id - Company ID
   * @returns true if deleted successfully
   */
  async deleteCompany(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM companies WHERE id = ?1')
      .bind(id)
      .run();
    return result.success && (result.meta.rows_read ?? 0) > 0;
  }

  // ============================================
  // Department CRUD Operations
  // ============================================

  /**
   * Retrieve a department by ID
   *
   * @param id - Department ID
   * @returns Department object or null if not found
   */
  async getDepartment(id: string): Promise<Department | null> {
    const result = await this.db
      .prepare('SELECT * FROM departments WHERE id = ?1')
      .bind(id)
      .first<Department>();
    return result || null;
  }

  /**
   * List departments by company ID
   *
   * @param companyId - Company ID
   * @returns Array of departments
   */
  async listDepartmentsByCompany(companyId: string): Promise<Department[]> {
    const result = await this.db
      .prepare('SELECT * FROM departments WHERE company_id = ?1 ORDER BY name')
      .bind(companyId)
      .all<Department>();
    return result.results;
  }

  /**
   * Create a new department
   *
   * @param data - Department creation data
   * @returns Created department object
   */
  async createDepartment(data: CreateDepartmentDto): Promise<Department> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO departments (
          id, company_id, name, quota_pool, quota_used, quota_daily, daily_used,
          last_reset_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
      )
      .bind(
        data.id,
        data.company_id,
        data.name,
        data.quota_pool ?? 0,
        0,
        data.quota_daily ?? 0,
        0,
        null,
        now,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to create department: ${result.error}`);
    }

    return this.getDepartment(data.id) as Promise<Department>;
  }

  /**
   * Update an existing department
   *
   * @param id - Department ID
   * @param data - Department update data
   * @returns Updated department object
   */
  async updateDepartment(id: string, data: UpdateDepartmentDto): Promise<Department> {
    const updates: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = ?${paramIndex++}`);
      params.push(data.name);
    }
    if (data.quota_pool !== undefined) {
      updates.push(`quota_pool = ?${paramIndex++}`);
      params.push(data.quota_pool);
    }
    if (data.quota_daily !== undefined) {
      updates.push(`quota_daily = ?${paramIndex++}`);
      params.push(data.quota_daily);
    }

    updates.push(`updated_at = ?${paramIndex++}`);
    params.push(Date.now());
    params.push(id);

    const query = `UPDATE departments SET ${updates.join(', ')} WHERE id = ?${paramIndex}`;
    const result = await this.db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error(`Failed to update department: ${result.error}`);
    }

    return this.getDepartment(id) as Promise<Department>;
  }

  /**
   * Delete a department by ID
   *
   * @param id - Department ID
   * @returns true if deleted successfully
   */
  async deleteDepartment(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM departments WHERE id = ?1')
      .bind(id)
      .run();
    return result.success && (result.meta.rows_read ?? 0) > 0;
  }

  // ============================================
  // User CRUD Operations
  // ============================================

  /**
   * Retrieve a user by ID
   *
   * @param id - User ID
   * @returns User object or null if not found
   */
  async getUser(id: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE id = ?1')
      .bind(id)
      .first<User>();
    return result || null;
  }

  /**
   * Retrieve a user by email
   *
   * @param email - User email
   * @returns User object or null if not found
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE email = ?1')
      .bind(email)
      .first<User>();
    return result || null;
  }

  /**
   * List users by company ID
   *
   * @param companyId - Company ID
   * @returns Array of users
   */
  async listUsersByCompany(companyId: string): Promise<User[]> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE company_id = ?1 ORDER BY created_at DESC')
      .bind(companyId)
      .all<User>();
    return result.results;
  }

  /**
   * Create a new user
   *
   * @param data - User creation data
   * @returns Created user object
   */
  async createUser(data: CreateUserDto): Promise<User> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO users (
          id, email, name, company_id, department_id, role, quota_daily, quota_used,
          is_active, last_reset_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      )
      .bind(
        data.id,
        data.email,
        data.name ?? null,
        data.company_id,
        data.department_id ?? null,
        data.role ?? 'user',
        data.quota_daily ?? 0,
        0,
        true,
        null,
        now,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to create user: ${result.error}`);
    }

    return this.getUser(data.id) as Promise<User>;
  }

  /**
   * Update an existing user
   *
   * @param id - User ID
   * @param data - User update data
   * @returns Updated user object
   */
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (data.email !== undefined) {
      updates.push(`email = ?${paramIndex++}`);
      params.push(data.email);
    }
    if (data.name !== undefined) {
      updates.push(`name = ?${paramIndex++}`);
      params.push(data.name);
    }
    if (data.department_id !== undefined) {
      updates.push(`department_id = ?${paramIndex++}`);
      params.push(data.department_id);
    }
    if (data.role !== undefined) {
      updates.push(`role = ?${paramIndex++}`);
      params.push(data.role);
    }
    if (data.quota_daily !== undefined) {
      updates.push(`quota_daily = ?${paramIndex++}`);
      params.push(data.quota_daily);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = ?${paramIndex++}`);
      params.push(data.is_active ? 1 : 0);
    }

    updates.push(`updated_at = ?${paramIndex++}`);
    params.push(Date.now());
    params.push(id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?${paramIndex}`;
    const result = await this.db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error(`Failed to update user: ${result.error}`);
    }

    return this.getUser(id) as Promise<User>;
  }

  /**
   * Delete a user by ID
   *
   * @param id - User ID
   * @returns true if deleted successfully
   */
  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM users WHERE id = ?1')
      .bind(id)
      .run();
    return result.success && (result.meta.rows_read ?? 0) > 0;
  }

  // ============================================
  // Provider CRUD Operations
  // ============================================

  /**
   * Retrieve a provider by ID
   *
   * @param id - Provider ID
   * @returns Provider object or null if not found
   */
  async getProvider(id: string): Promise<Provider | null> {
    const result = await this.db
      .prepare('SELECT * FROM providers WHERE id = ?1')
      .bind(id)
      .first<Provider>();
    return result || null;
  }

  /**
   * Retrieve a provider by name
   *
   * @param name - Provider name (e.g., 'anthropic')
   * @returns Provider object or null if not found
   */
  async getProviderByName(name: string): Promise<Provider | null> {
    const result = await this.db
      .prepare('SELECT * FROM providers WHERE name = ?1')
      .bind(name)
      .first<Provider>();
    return result || null;
  }

  /**
   * List all active providers
   *
   * @returns Array of active providers
   */
  async listActiveProviders(): Promise<Provider[]> {
    const result = await this.db
      .prepare('SELECT * FROM providers WHERE is_active = 1 ORDER BY created_at')
      .all<Provider>();
    return result.results;
  }

  /**
   * List all providers
   *
   * @returns Array of all providers
   */
  async listProviders(): Promise<Provider[]> {
    const result = await this.db
      .prepare('SELECT * FROM providers ORDER BY created_at')
      .all<Provider>();
    return result.results;
  }

  /**
   * Create a new provider
   *
   * @param data - Provider creation data
   * @returns Created provider object
   */
  async createProvider(data: CreateProviderDto): Promise<Provider> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO providers (
          id, name, display_name, base_url, api_version, is_active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        data.id,
        data.name,
        data.display_name,
        data.base_url,
        data.api_version ?? null,
        true,
        now,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to create provider: ${result.error}`);
    }

    return this.getProvider(data.id) as Promise<Provider>;
  }

  /**
   * Update an existing provider
   *
   * @param id - Provider ID
   * @param data - Provider update data
   * @returns Updated provider object
   */
  async updateProvider(id: string, data: UpdateProviderDto): Promise<Provider> {
    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (data.display_name !== undefined) {
      updates.push(`display_name = ?${paramIndex++}`);
      params.push(data.display_name);
    }
    if (data.base_url !== undefined) {
      updates.push(`base_url = ?${paramIndex++}`);
      params.push(data.base_url);
    }
    if (data.api_version !== undefined) {
      updates.push(`api_version = ?${paramIndex++}`);
      params.push(data.api_version);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = ?${paramIndex++}`);
      params.push(data.is_active ? 1 : 0);
    }

    updates.push(`updated_at = ?${paramIndex++}`);
    params.push(Date.now());
    params.push(id);

    const query = `UPDATE providers SET ${updates.join(', ')} WHERE id = ?${paramIndex}`;
    const result = await this.db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error(`Failed to update provider: ${result.error}`);
    }

    return this.getProvider(id) as Promise<Provider>;
  }

  /**
   * Delete a provider by ID
   *
   * @param id - Provider ID
   * @returns true if deleted successfully
   */
  async deleteProvider(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM providers WHERE id = ?1')
      .bind(id)
      .run();
    return result.success && (result.meta.rows_read ?? 0) > 0;
  }

  // ============================================
  // Model CRUD Operations
  // ============================================

  /**
   * Retrieve a model by ID
   *
   * @param id - Model ID
   * @returns Model object or null if not found
   */
  async getModel(id: string): Promise<Model | null> {
    const result = await this.db
      .prepare('SELECT * FROM models WHERE id = ?1')
      .bind(id)
      .first<Model>();
    return result || null;
  }

  /**
   * Retrieve a model by model_id (e.g., 'claude-3-sonnet')
   *
   * @param modelId - Model identifier
   * @returns Model object or null if not found
   */
  async getModelByModelId(modelId: string): Promise<Model | null> {
    const result = await this.db
      .prepare('SELECT * FROM models WHERE model_id = ?1')
      .bind(modelId)
      .first<Model>();
    return result || null;
  }

  /**
   * List all active models
   *
   * @returns Array of active models
   */
  async listActiveModels(): Promise<Model[]> {
    const result = await this.db
      .prepare('SELECT * FROM models WHERE is_active = 1 ORDER BY created_at')
      .all<Model>();
    return result.results;
  }

  /**
   * List all models
   *
   * @returns Array of all models
   */
  async listModels(): Promise<Model[]> {
    const result = await this.db
      .prepare('SELECT * FROM models ORDER BY created_at')
      .all<Model>();
    return result.results;
  }

  /**
   * Create a new model
   *
   * @param data - Model creation data
   * @returns Created model object
   */
  async createModel(data: CreateModelDto): Promise<Model> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO models (
          id, model_id, display_name, context_window, max_tokens, is_active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        data.id,
        data.model_id,
        data.display_name,
        data.context_window ?? 0,
        data.max_tokens ?? 0,
        true,
        now,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to create model: ${result.error}`);
    }

    return this.getModel(data.id) as Promise<Model>;
  }

  /**
   * Update an existing model
   *
   * @param id - Model ID
   * @param data - Model update data
   * @returns Updated model object
   */
  async updateModel(id: string, data: UpdateModelDto): Promise<Model> {
    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (data.display_name !== undefined) {
      updates.push(`display_name = ?${paramIndex++}`);
      params.push(data.display_name);
    }
    if (data.context_window !== undefined) {
      updates.push(`context_window = ?${paramIndex++}`);
      params.push(data.context_window);
    }
    if (data.max_tokens !== undefined) {
      updates.push(`max_tokens = ?${paramIndex++}`);
      params.push(data.max_tokens);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = ?${paramIndex++}`);
      params.push(data.is_active ? 1 : 0);
    }

    updates.push(`updated_at = ?${paramIndex++}`);
    params.push(Date.now());
    params.push(id);

    const query = `UPDATE models SET ${updates.join(', ')} WHERE id = ?${paramIndex}`;
    const result = await this.db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error(`Failed to update model: ${result.error}`);
    }

    return this.getModel(id) as Promise<Model>;
  }

  /**
   * Delete a model by ID
   *
   * @param id - Model ID
   * @returns true if deleted successfully
   */
  async deleteModel(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM models WHERE id = ?1')
      .bind(id)
      .run();
    return result.success && (result.meta.rows_read ?? 0) > 0;
  }

  // ============================================
  // ModelProvider Operations
  // ============================================

  /**
   * Get active providers for a model
   *
   * @param modelId - Model ID
   * @returns Array of model-provider associations
   */
  async getActiveProvidersForModel(modelId: string): Promise<ModelProvider[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM model_providers
         WHERE model_id = ?1 AND is_active = 1
         ORDER BY priority DESC`
      )
      .bind(modelId)
      .all<ModelProvider>();
    return result.results;
  }

  /**
   * Associate a model with a provider
   *
   * @param data - ModelProvider creation data
   * @returns Created association
   */
  async associateModelProvider(data: {
    id: string;
    model_id: string;
    provider_id: string;
    input_price?: number;
    output_price?: number;
    priority?: number;
  }): Promise<ModelProvider> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO model_providers (
          id, model_id, provider_id, input_price, output_price, priority, is_active, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        data.id,
        data.model_id,
        data.provider_id,
        data.input_price ?? 0,
        data.output_price ?? 0,
        data.priority ?? 0,
        true,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to associate model with provider: ${result.error}`);
    }

    const mp = await this.db
      .prepare('SELECT * FROM model_providers WHERE id = ?1')
      .bind(data.id)
      .first<ModelProvider>();

    return mp as ModelProvider;
  }

  // ============================================
  // DepartmentModel Operations
  // ============================================

  /**
   * Get model configuration for a department
   *
   * @param departmentId - Department ID
   * @param modelId - Model ID
   * @returns DepartmentModel configuration or null
   */
  async getDepartmentModel(
    departmentId: string,
    modelId: string
  ): Promise<DepartmentModel | null> {
    const result = await this.db
      .prepare(
        'SELECT * FROM department_models WHERE department_id = ?1 AND model_id = ?2'
      )
      .bind(departmentId, modelId)
      .first<DepartmentModel>();
    return result || null;
  }

  /**
   * List allowed models for a department
   *
   * @param departmentId - Department ID
   * @returns Array of allowed model configurations
   */
  async listAllowedModelsForDepartment(departmentId: string): Promise<DepartmentModel[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM department_models
         WHERE department_id = ?1 AND is_allowed = 1`
      )
      .bind(departmentId)
      .all<DepartmentModel>();
    return result.results;
  }

  /**
   * Set model access for a department
   *
   * @param data - DepartmentModel data
   * @returns Created or updated configuration
   */
  async setDepartmentModelAccess(data: {
    id: string;
    department_id: string;
    model_id: string;
    is_allowed?: boolean;
    daily_quota?: number;
  }): Promise<DepartmentModel> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO department_models (
          id, department_id, model_id, is_allowed, daily_quota, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT (department_id, model_id) DO UPDATE SET
          is_allowed = ?4,
          daily_quota = ?5`
      )
      .bind(
        data.id,
        data.department_id,
        data.model_id,
        data.is_allowed !== undefined ? (data.is_allowed ? 1 : 0) : 1,
        data.daily_quota ?? 0,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to set department model access: ${result.error}`);
    }

    return this.getDepartmentModel(data.department_id, data.model_id) as Promise<DepartmentModel>;
  }

  // ============================================
  // API Key Operations
  // ============================================

  /**
   * Retrieve an API key by its hash
   *
   * @param keyHash - SHA-256 hash of the API key
   * @returns ApiKey object or null if not found
   */
  async getApiKeyByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const result = await this.db
      .prepare('SELECT * FROM api_keys WHERE key_hash = ?1')
      .bind(keyHash)
      .first<ApiKey>();
    return result || null;
  }

  /**
   * Retrieve an API key by ID
   *
   * @param id - API key ID
   * @returns ApiKey object or null if not found
   */
  async getApiKey(id: string): Promise<ApiKey | null> {
    const result = await this.db
      .prepare('SELECT * FROM api_keys WHERE id = ?1')
      .bind(id)
      .first<ApiKey>();
    return result || null;
  }

  /**
   * List API keys by user ID
   *
   * @param userId - User ID
   * @returns Array of API keys
   */
  async listApiKeysByUser(userId: string): Promise<ApiKey[]> {
    const result = await this.db
      .prepare('SELECT * FROM api_keys WHERE user_id = ?1 ORDER BY created_at DESC')
      .bind(userId)
      .all<ApiKey>();
    return result.results;
  }

  /**
   * List API keys by company ID
   *
   * @param companyId - Company ID
   * @returns Array of API keys
   */
  async listApiKeysByCompany(companyId: string): Promise<ApiKey[]> {
    const result = await this.db
      .prepare('SELECT * FROM api_keys WHERE company_id = ?1 ORDER BY created_at DESC')
      .bind(companyId)
      .all<ApiKey>();
    return result.results;
  }

  /**
   * Create a new API key
   *
   * @param data - API key creation data
   * @returns Created API key object
   */
  async createApiKey(data: CreateApiKeyDto): Promise<ApiKey> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO api_keys (
          id, key_hash, key_prefix, user_id, company_id, department_id, name,
          quota_daily, quota_used, quota_bonus, quota_bonus_expiry,
          is_unlimited, is_active, last_reset_at, last_used_at, expires_at,
          created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`
      )
      .bind(
        data.id,
        data.key_hash,
        data.key_prefix,
        data.user_id,
        data.company_id,
        data.department_id ?? null,
        data.name ?? null,
        data.quota_daily ?? 0,
        0,
        0,
        null,
        data.is_unlimited ? 1 : 0,
        true,
        null,
        null,
        data.expires_at ?? null,
        now,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to create API key: ${result.error}`);
    }

    return this.getApiKey(data.id) as Promise<ApiKey>;
  }

  /**
   * Update an existing API key
   *
   * @param id - API key ID
   * @param data - API key update data
   * @returns Updated API key object
   */
  async updateApiKey(id: string, data: UpdateApiKeyDto): Promise<ApiKey> {
    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = ?${paramIndex++}`);
      params.push(data.name);
    }
    if (data.quota_daily !== undefined) {
      updates.push(`quota_daily = ?${paramIndex++}`);
      params.push(data.quota_daily);
    }
    if (data.is_unlimited !== undefined) {
      updates.push(`is_unlimited = ?${paramIndex++}`);
      params.push(data.is_unlimited ? 1 : 0);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = ?${paramIndex++}`);
      params.push(data.is_active ? 1 : 0);
    }
    if (data.expires_at !== undefined) {
      updates.push(`expires_at = ?${paramIndex++}`);
      params.push(data.expires_at ? new Date(data.expires_at).getTime() : null);
    }

    updates.push(`updated_at = ?${paramIndex++}`);
    params.push(Date.now());
    params.push(id);

    const query = `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?${paramIndex}`;
    const result = await this.db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error(`Failed to update API key: ${result.error}`);
    }

    return this.getApiKey(id) as Promise<ApiKey>;
  }

  /**
   * Update API key last used timestamp
   *
   * @param id - API key ID
   * @returns Updated API key object
   */
  async updateApiKeyLastUsed(id: string): Promise<ApiKey> {
    const result = await this.db
      .prepare('UPDATE api_keys SET last_used_at = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(Date.now(), Date.now(), id)
      .run();

    if (!result.success) {
      throw new Error(`Failed to update API key last used: ${result.error}`);
    }

    return this.getApiKey(id) as Promise<ApiKey>;
  }

  /**
   * Add bonus quota to an API key
   *
   * @param id - API key ID
   * @param amount - Bonus amount
   * @param expiry - Expiry timestamp (optional)
   * @returns Updated API key object
   */
  async addApiKeyBonus(id: string, amount: number, expiry?: number): Promise<ApiKey> {
    const result = await this.db
      .prepare(
        'UPDATE api_keys SET quota_bonus = quota_bonus + ?1, quota_bonus_expiry = ?2, updated_at = ?3 WHERE id = ?4'
      )
      .bind(amount, expiry ?? null, Date.now(), id)
      .run();

    if (!result.success) {
      throw new Error(`Failed to add API key bonus: ${result.error}`);
    }

    return this.getApiKey(id) as Promise<ApiKey>;
  }

  /**
   * Delete an API key by ID
   *
   * @param id - API key ID
   * @returns true if deleted successfully
   */
  async deleteApiKey(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM api_keys WHERE id = ?1')
      .bind(id)
      .run();
    return result.success && (result.meta.rows_read ?? 0) > 0;
  }

  // ============================================
  // Provider Credential Operations
  // ============================================

  /**
   * Get active credentials for a provider
   *
   * @param providerId - Provider ID
   * @returns Array of active credentials sorted by priority
   */
  async getActiveCredentialsForProvider(providerId: string): Promise<ProviderCredential[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM provider_credentials
         WHERE provider_id = ?1 AND is_active = 1
         ORDER BY priority DESC, weight DESC`
      )
      .bind(providerId)
      .all<ProviderCredential>();
    return result.results;
  }

  /**
   * Get a credential by ID
   *
   * @param id - Credential ID
   * @returns ProviderCredential object or null
   */
  async getCredential(id: string): Promise<ProviderCredential | null> {
    const result = await this.db
      .prepare('SELECT * FROM provider_credentials WHERE id = ?1')
      .bind(id)
      .first<ProviderCredential>();
    return result || null;
  }

  /**
   * Create a new provider credential
   *
   * @param data - Credential creation data
   * @returns Created credential object
   */
  async createCredential(data: {
    id: string;
    provider_id: string;
    credential_name: string;
    api_key_encrypted: string;
    priority?: number;
    weight?: number;
  }): Promise<ProviderCredential> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO provider_credentials (
          id, provider_id, credential_name, api_key_encrypted,
          is_active, priority, weight, health_status,
          last_health_check, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      )
      .bind(
        data.id,
        data.provider_id,
        data.credential_name,
        data.api_key_encrypted,
        true,
        data.priority ?? 0,
        data.weight ?? 1,
        'unknown',
        null,
        now,
        now
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to create credential: ${result.error}`);
    }

    return this.getCredential(data.id) as Promise<ProviderCredential>;
  }

  /**
   * Update credential health status
   *
   * @param id - Credential ID
   * @param status - New health status ('healthy', 'unhealthy', 'unknown')
   * @returns Updated credential object
   */
  async updateCredentialHealth(id: string, status: string): Promise<ProviderCredential> {
    const result = await this.db
      .prepare(
        'UPDATE provider_credentials SET health_status = ?1, last_health_check = ?2, updated_at = ?3 WHERE id = ?4'
      )
      .bind(status, Date.now(), Date.now(), id)
      .run();

    if (!result.success) {
      throw new Error(`Failed to update credential health: ${result.error}`);
    }

    return this.getCredential(id) as Promise<ProviderCredential>;
  }

  // ============================================
  // Usage & Quota Operations
  // ============================================

  /**
   * Create a usage log entry
   *
   * @param data - Usage log data
   * @returns Created usage log
   */
  async createUsageLog(data: CreateUsageLogDto): Promise<UsageLog> {
    const result = await this.db
      .prepare(
        `INSERT INTO usage_logs (
          id, api_key_id, user_id, company_id, department_id,
          provider_id, model_id, model_name, endpoint,
          input_tokens, output_tokens, total_tokens,
          status, error_code, request_id, response_time_ms, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
      )
      .bind(
        data.id,
        data.api_key_id,
        data.user_id,
        data.company_id,
        data.department_id,
        data.provider_id,
        data.model_id,
        data.model_name,
        data.endpoint,
        data.input_tokens,
        data.output_tokens,
        data.total_tokens,
        data.status,
        data.error_code ?? null,
        data.request_id ?? null,
        data.response_time_ms ?? null,
        Date.now()
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to create usage log: ${result.error}`);
    }

    const log = await this.db
      .prepare('SELECT * FROM usage_logs WHERE id = ?1')
      .bind(data.id)
      .first<UsageLog>();

    return log as UsageLog;
  }

  /**
   * Record a quota change
   *
   * @param data - Quota change data
   * @returns Created quota change record
   */
  async recordQuotaChange(data: QuotaChangeDto): Promise<void> {
    const result = await this.db
      .prepare(
        `INSERT INTO quota_changes (
          id, entity_type, entity_id, change_type, change_amount,
          previous_quota, new_quota, reason, created_by, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
      )
      .bind(
        data.id,
        data.entity_type,
        data.entity_id,
        data.change_type,
        data.change_amount,
        data.previous_quota,
        data.new_quota,
        data.reason ?? null,
        data.created_by ?? null,
        Date.now()
      )
      .run();

    if (!result.success) {
      throw new Error(`Failed to record quota change: ${result.error}`);
    }
  }

  /**
   * Get usage statistics for a time period
   *
   * @param companyId - Company ID
   * @param startDate - Start timestamp
   * @param endDate - End timestamp
   * @returns Array of usage logs
   */
  async getUsageByTimeRange(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<UsageLog[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM usage_logs
         WHERE company_id = ?1 AND created_at >= ?2 AND created_at <= ?3
         ORDER BY created_at DESC`
      )
      .bind(companyId, startDate, endDate)
      .all<UsageLog>();
    return result.results;
  }

  /**
   * Get usage statistics by model
   *
   * @param companyId - Company ID
   * @param startDate - Start timestamp
   * @param endDate - End timestamp
   * @returns Array of usage records grouped by model
   */
  async getUsageByModel(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<Array<{ model_id: string; model_name: string; total_tokens: number; request_count: number }>> {
    const result = await this.db
      .prepare(
        `SELECT model_id, model_name, SUM(total_tokens) as total_tokens, COUNT(*) as request_count
         FROM usage_logs
         WHERE company_id = ?1 AND created_at >= ?2 AND created_at <= ?3
         GROUP BY model_id, model_name
         ORDER BY total_tokens DESC`
      )
      .bind(companyId, startDate, endDate)
      .all();

    return result.results as Array<{
      model_id: string;
      model_name: string;
      total_tokens: number;
      request_count: number;
    }>;
  }

  /**
   * Get quota changes for an entity
   *
   * @param entityType - Entity type ('api_key', 'department', 'company')
   * @param entityId - Entity ID
   * @returns Array of quota change records
   */
  async getQuotaChanges(entityType: string, entityId: string): Promise<QuotaChange[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM quota_changes
         WHERE entity_type = ?1 AND entity_id = ?2
         ORDER BY created_at DESC`
      )
      .bind(entityType, entityId)
      .all<QuotaChange>();
    return result.results;
  }

  // ============================================
  // Quota Reset Operations
  // ============================================

  /**
   * Reset daily quota for an entity
   *
   * @param entityType - Entity type ('api_key', 'user', 'department', 'company')
   * @param entityId - Entity ID
   * @param resetTime - Reset timestamp (UTC 0:00 of the day)
   * @returns true if reset was performed
   */
  async resetDailyQuota(
    entityType: string,
    entityId: string,
    resetTime: number
  ): Promise<boolean> {
    const tableName =
      entityType === 'company'
        ? 'companies'
        : entityType === 'department'
          ? 'departments'
          : entityType === 'user'
            ? 'users'
            : 'api_keys';

    const usedColumn = entityType === 'company' || entityType === 'department' ? 'daily_used' : 'quota_used';

    const result = await this.db
      .prepare(
        `UPDATE ${tableName}
         SET ${usedColumn} = 0, last_reset_at = ?1, updated_at = ?2
         WHERE id = ?3 AND (last_reset_at IS NULL OR last_reset_at < ?1)`
      )
      .bind(resetTime, Date.now(), entityId)
      .run();

    return result.success && (result.meta.rows_read ?? 0) > 0;
  }
}
