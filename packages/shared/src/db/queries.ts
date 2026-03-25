/**
 * Database Query Layer for AI Gateway
 *
 * Provides CRUD operations for all entities using prepared statements
 * to prevent SQL injection. Compatible with Cloudflare D1 (SQLite).
 *
 * @module db/queries
 */

// Import entity types from types/index.ts to avoid duplication
import type {
  Company,
  Department,
  DepartmentWithDetails,
  User,
  Provider,
  Model,
  ModelProvider,
  DepartmentModel,
  ApiKey,
  ProviderCredential,
  UsageLog,
  QuotaChange,
} from "../types/index.js";

// Re-export entity types for backward compatibility
export type {
  Company,
  Department,
  User,
  Provider,
  Model,
  ModelProvider,
  DepartmentModel,
  ApiKey,
  ProviderCredential,
  UsageLog,
  QuotaChange,
};

// ============================================
// Internal DTO Types (used only within queries.ts)
// Note: These are for database operations, different from API DTOs in types/index.ts
// ============================================

export interface InternalCreateCompanyDto {
  id: string;
  name: string;
  quota_pool?: number;
  quota_daily?: number;
}

export interface InternalUpdateCompanyDto {
  name?: string;
  quota_pool?: number;
  quota_daily?: number;
}

export interface InternalCreateDepartmentDto {
  id: string;
  company_id: string;
  name: string;
  quota_pool?: number;
  quota_daily?: number;
}

export interface InternalUpdateDepartmentDto {
  name?: string;
  quota_pool?: number;
  quota_daily?: number;
}

export interface InternalCreateUserDto {
  id: string;
  email: string;
  name?: string;
  company_id?: string;  // PRD V2: 第一期不强制要求，留待第二期使用
  department_id?: string;
  role?: string;
  quota_daily?: number;
}

export interface InternalUpdateUserDto {
  email?: string;
  name?: string;
  department_id?: string;
  role?: string;
  quota_daily?: number;
  is_active?: boolean;
  is_unlimited?: boolean;
}

export interface InternalCreateProviderDto {
  id: string;
  name: string;
  display_name: string;
  base_url: string;
  api_version?: string | null;
}

export interface InternalUpdateProviderDto {
  display_name?: string;
  base_url?: string;
  api_version?: string;
  is_active?: boolean;
}

export interface InternalCreateModelDto {
  id: string;
  model_id: string;
  alias?: string | null;
  display_name: string;
  context_window?: number;
  max_tokens?: number;
}

export interface InternalUpdateModelDto {
  alias?: string | null;
  display_name?: string;
  context_window?: number;
  max_tokens?: number;
  is_active?: boolean;
}

export interface InternalCreateApiKeyDto {
  id: string;
  key_hash: string;
  key_prefix: string;
  user_id: string;
  company_id: string;
  department_id?: string | null;
  name?: string | null;
  quota_daily?: number;
  is_unlimited?: boolean;
  expires_at?: number | null;
}

export interface InternalUpdateApiKeyDto {
  name?: string;
  quota_daily?: number;
  is_unlimited?: boolean;
  is_active?: boolean;
  expires_at?: number | null;
  updated_at?: number;
}

export interface InternalCreateUsageLogDto {
  id: string;
  api_key_id: string;
  user_id: string;
  company_id: string | null;
  department_id: string | null;
  provider_id: string;
  model_id: string;
  model_name: string;
  endpoint: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  status: string;
  error_code?: string | null;
  request_id?: string | null;
  response_time_ms?: number | null;
}

export interface InternalQuotaChangeDto {
  id: string;
  entity_type: string;
  entity_id: string;
  change_type: string;
  change_amount: number;
  previous_quota: number;
  new_quota: number;
  reason?: string | null;
  created_by?: string | null;
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
  async createCompany(data: InternalCreateCompanyDto): Promise<Company> {
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
  async updateCompany(id: string, data: InternalUpdateCompanyDto): Promise<Company> {
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
   * List all companies with user and department counts
   *
   * @returns Array of all companies with stats
   */
  async listCompanies(): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT
          c.*,
          (SELECT COUNT(*) FROM users WHERE users.company_id = c.id AND users.is_active = TRUE) as user_count,
          (SELECT COUNT(*) FROM departments WHERE departments.company_id = c.id) as department_count
        FROM companies c
        ORDER BY c.created_at DESC
      `)
      .all();
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
   * @returns Array of departments with company name and user count
   */
  async listDepartmentsByCompany(companyId: string): Promise<DepartmentWithDetails[]> {
    const result = await this.db
      .prepare(`
        SELECT
          d.*,
          c.name as company_name,
          COUNT(u.id) as user_count
        FROM departments d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN users u ON d.id = u.department_id
        WHERE d.company_id = ?1
        GROUP BY d.id
        ORDER BY d.name
      `)
      .bind(companyId)
      .all<DepartmentWithDetails>();
    return result.results;
  }

  /**
   * List all departments
   *
   * @returns Array of all departments with company name and user count
   */
  async listAllDepartments(): Promise<DepartmentWithDetails[]> {
    const result = await this.db
      .prepare(`
        SELECT
          d.*,
          c.name as company_name,
          COUNT(u.id) as user_count
        FROM departments d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN users u ON d.id = u.department_id
        GROUP BY d.id
        ORDER BY d.company_id, d.name
      `)
      .all<DepartmentWithDetails>();
    return result.results;
  }

  /**
   * Create a new department
   *
   * @param data - Department creation data
   * @returns Created department object
   */
  async createDepartment(data: InternalCreateDepartmentDto): Promise<Department> {
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
  async updateDepartment(id: string, data: InternalUpdateDepartmentDto): Promise<Department> {
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
  async listUsersByCompany(companyId: string): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT u.*,
          c.name as company_name,
          d.name as department_name,
          (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id) as api_key_count
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.company_id = ?1
        ORDER BY u.created_at DESC
      `)
      .bind(companyId)
      .all();
    return result.results;
  }

  /**
   * List users by department
   *
   * @param departmentId - Department ID
   * @returns Array of users
   */
  async listUsersByDepartment(departmentId: string): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT u.*,
          c.name as company_name,
          d.name as department_name,
          (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id) as api_key_count
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.department_id = ?1
        ORDER BY u.created_at DESC
      `)
      .bind(departmentId)
      .all();
    return result.results;
  }

  /**
   * List all users
   *
   * PRD V2 第一期：不依赖组织架构排序
   *
   * @returns Array of all users
   */
  async listAllUsers(): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT u.*,
          c.name as company_name,
          d.name as department_name,
          (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id) as api_key_count
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.created_at DESC
      `)
      .all();
    return result.results;
  }

  /**
   * Create a new user
   *
   * @param data - User creation data
   * @returns Created user object
   */
  async createUser(data: InternalCreateUserDto): Promise<User> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO users (
          id, email, name, company_id, department_id, role, quota_daily, quota_used,
          is_active, is_unlimited, last_reset_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
      )
      .bind(
        data.id,
        data.email,
        data.name ?? null,
        data.company_id ?? null,  // PRD V2: 第一期不强制要求
        data.department_id ?? null,
        data.role ?? 'user',
        data.quota_daily ?? 0,
        0,
        true,
        false,
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
  async updateUser(id: string, data: InternalUpdateUserDto): Promise<User> {
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
    if (data.is_unlimited !== undefined) {
      updates.push(`is_unlimited = ?${paramIndex++}`);
      params.push(data.is_unlimited ? 1 : 0);
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
  async createProvider(data: InternalCreateProviderDto): Promise<Provider> {
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
  async updateProvider(id: string, data: InternalUpdateProviderDto): Promise<Provider> {
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

  /**
   * Get the cheapest model for a provider (for health check auto-selection)
   *
   * Per PRD V2 Section 2.3.2: Automatically select the cheapest model for health checks
   *
   * @param providerId - Provider ID
   * @returns Model info (id, model_id, actual_model_id) or null if no models found
   */
  async getCheapestModelForProvider(providerId: string): Promise<{
    id: string;
    model_id: string;
    actual_model_id: string | null;
  } | null> {
    const result = await this.db
      .prepare(`
        SELECT m.id, m.model_id, mp.actual_model_id
        FROM model_providers mp
        INNER JOIN models m ON mp.model_id = m.id
        WHERE mp.provider_id = ?1 AND mp.is_active = 1 AND m.is_active = 1
        ORDER BY mp.input_price ASC
        LIMIT 1
      `)
      .bind(providerId)
      .first<{
        id: string;
        model_id: string;
        actual_model_id: string | null;
      }>();
    return result || null;
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
   * Get a model by alias.
   *
   * @param alias - Model alias
   * @returns Model object or null if not found
   */
  async getModelByAlias(alias: string): Promise<Model | null> {
    const result = await this.db
      .prepare('SELECT * FROM models WHERE alias = ?1')
      .bind(alias)
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
  async createModel(data: InternalCreateModelDto): Promise<Model> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO models (
          id, model_id, alias, display_name, context_window, max_tokens, is_active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      )
      .bind(
        data.id,
        data.model_id,
        data.alias ?? null,
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
  async updateModel(id: string, data: InternalUpdateModelDto): Promise<Model> {
    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (data.alias !== undefined) {
      updates.push(`alias = ?${paramIndex++}`);
      params.push(data.alias);
    }
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
  // ModelProvider Operations (n:n relationship)
  // ============================================

  /**
   * Get all providers for a model
   *
   * @param modelId - Model ID
   * @returns Array of model-provider configurations with provider details
   */
  async getProvidersForModel(
    modelId: string
  ): Promise<Array<ModelProvider & { provider_name: string; provider_display_name: string }>> {
    const result = await this.db
      .prepare(
        `SELECT mp.*, p.name as provider_name, p.display_name as provider_display_name
         FROM model_providers mp
         JOIN providers p ON mp.provider_id = p.id
         WHERE mp.model_id = ?1
         ORDER BY mp.created_at`
      )
      .bind(modelId)
      .all<ModelProvider & { provider_name: string; provider_display_name: string }>();
    return result.results;
  }

  /**
   * Get active providers for a model (for load balancing)
   *
   * @param modelId - Model ID
   * @returns Array of active model-provider configurations
   */
  async getActiveProvidersForModel(
    modelId: string
  ): Promise<Array<ModelProvider & { provider_is_active: boolean }>> {
    const result = await this.db
      .prepare(
        `SELECT mp.*, p.is_active as provider_is_active
         FROM model_providers mp
         JOIN providers p ON mp.provider_id = p.id
         WHERE mp.model_id = ?1 AND mp.is_active = 1 AND p.is_active = 1
         ORDER BY mp.created_at`
      )
      .bind(modelId)
      .all<ModelProvider & { provider_is_active: boolean }>();
    return result.results;
  }

  /**
   * Get a specific model-provider configuration
   *
   * @param modelId - Model ID
   * @param providerId - Provider ID
   * @returns ModelProvider configuration or null
   */
  async getModelProvider(
    modelId: string,
    providerId: string
  ): Promise<ModelProvider | null> {
    const result = await this.db
      .prepare('SELECT * FROM model_providers WHERE model_id = ?1 AND provider_id = ?2')
      .bind(modelId, providerId)
      .first<ModelProvider>();
    return result || null;
  }

  /**
   * Add a provider to a model
   *
   * @param data - ModelProvider creation data
   * @returns Created model-provider configuration
   */
  async addModelProvider(data: {
    id: string;
    model_id: string;
    provider_id: string;
    actual_model_id?: string | null;
    input_price: number;
    output_price: number;
  }): Promise<ModelProvider> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO model_providers (
          id, model_id, provider_id, actual_model_id, input_price, output_price, is_active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)`
      )
      .bind(data.id, data.model_id, data.provider_id, data.actual_model_id ?? null, data.input_price, data.output_price, now)
      .run();

    if (!result.success) {
      throw new Error(`Failed to add model provider: ${result.error}`);
    }

    return this.getModelProvider(data.model_id, data.provider_id) as Promise<ModelProvider>;
  }

  /**
   * Update model-provider configuration
   *
   * @param modelId - Model ID
   * @param providerId - Provider ID
   * @param data - Update data
   * @returns Updated model-provider configuration
   */
  async updateModelProvider(
    modelId: string,
    providerId: string,
    data: {
      actual_model_id?: string | null;
      input_price?: number;
      output_price?: number;
      is_active?: boolean;
    }
  ): Promise<ModelProvider> {
    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (data.actual_model_id !== undefined) {
      updates.push(`actual_model_id = ?${paramIndex++}`);
      params.push(data.actual_model_id);
    }
    if (data.input_price !== undefined) {
      updates.push(`input_price = ?${paramIndex++}`);
      params.push(data.input_price);
    }
    if (data.output_price !== undefined) {
      updates.push(`output_price = ?${paramIndex++}`);
      params.push(data.output_price);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = ?${paramIndex++}`);
      params.push(data.is_active ? 1 : 0);
    }

    updates.push(`updated_at = ?${paramIndex++}`);
    params.push(Date.now());
    params.push(modelId, providerId);

    const query = `UPDATE model_providers SET ${updates.join(', ')} WHERE model_id = ?${paramIndex++} AND provider_id = ?${paramIndex++}`;
    const result = await this.db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error(`Failed to update model provider: ${result.error}`);
    }

    return this.getModelProvider(modelId, providerId) as Promise<ModelProvider>;
  }

  /**
   * Remove a provider from a model
   *
   * @param modelId - Model ID
   * @param providerId - Provider ID
   * @returns true if deleted successfully
   */
  async removeModelProvider(modelId: string, providerId: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM model_providers WHERE model_id = ?1 AND provider_id = ?2')
      .bind(modelId, providerId)
      .run();
    return result.success && (result.meta.rows_read ?? 0) > 0;
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
  async createApiKey(data: InternalCreateApiKeyDto): Promise<ApiKey> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO api_keys (
          id, key_hash, key_prefix, user_id, company_id, department_id, name,
          quota_daily, quota_used, quota_bonus, quota_bonus_used, quota_bonus_expiry,
          is_unlimited, is_active, last_reset_at, last_used_at, expires_at,
          created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)`
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
  async updateApiKey(id: string, data: InternalUpdateApiKeyDto): Promise<ApiKey> {
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
  async addApiKeyBonus(
    id: string,
    amountOrOptions: number | { amount: number; expires_at: number | null },
    expiry?: number
  ): Promise<ApiKey> {
    let amount: number;
    let expiresAt: number | null;

    if (typeof amountOrOptions === 'object') {
      amount = amountOrOptions.amount;
      expiresAt = amountOrOptions.expires_at;
    } else {
      amount = amountOrOptions;
      expiresAt = expiry ?? null;
    }

    const result = await this.db
      .prepare(
        'UPDATE api_keys SET quota_bonus = quota_bonus + ?1, quota_bonus_expiry = ?2, updated_at = ?3 WHERE id = ?4'
      )
      .bind(amount, expiresAt, Date.now(), id)
      .run();

    if (!result.success) {
      throw new Error(`Failed to add API key bonus: ${result.error}`);
    }

    return this.getApiKey(id) as Promise<ApiKey>;
  }

  /**
   * Clean up expired bonus quota for an API key.
   *
   * If the bonus has expired, resets quota_bonus, quota_bonus_used, and quota_bonus_expiry to 0/null.
   *
   * @param id - API key ID
   * @returns true if cleanup was performed, false if not expired
   */
  async cleanupExpiredBonus(id: string): Promise<boolean> {
    const key = await this.db
      .prepare('SELECT quota_bonus_expiry FROM api_keys WHERE id = ?1')
      .bind(id)
      .first<{ quota_bonus_expiry: number | null }>();

    if (!key || !key.quota_bonus_expiry) {
      return false; // No expiry set, nothing to clean
    }

    const now = Date.now();
    if (key.quota_bonus_expiry > now) {
      return false; // Not expired yet
    }

    // Bonus has expired, clean it up
    const result = await this.db
      .prepare(
        'UPDATE api_keys SET quota_bonus = 0, quota_bonus_used = 0, quota_bonus_expiry = NULL, updated_at = ?1 WHERE id = ?2'
      )
      .bind(now, id)
      .run();

    return result.success;
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

  /**
   * List API keys with optional filtering
   *
   * @param options - Query options
   * @returns Array of API keys
   */
  async listApiKeys(options: {
    user_id?: string;
    company_id?: string;
    department_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiKey[]> {
    const conditions: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (options.user_id !== undefined) {
      conditions.push(`user_id = ?${paramIndex++}`);
      params.push(options.user_id);
    }
    if (options.company_id !== undefined) {
      conditions.push(`company_id = ?${paramIndex++}`);
      params.push(options.company_id);
    }
    if (options.department_id !== undefined) {
      conditions.push(`department_id = ?${paramIndex++}`);
      params.push(options.department_id);
    }
    if (options.is_active !== undefined) {
      conditions.push(`is_active = ?${paramIndex++}`);
      params.push(options.is_active ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const result = await this.db
      .prepare(
        `SELECT * FROM api_keys ${whereClause} ORDER BY created_at DESC LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}`
      )
      .bind(...params, limit, offset)
      .all<ApiKey>();
    return result.results;
  }

  /**
   * Reset API key quota usage
   *
   * @param id - API key ID
   * @returns Updated API key object
   */
  async resetApiKeyQuota(id: string): Promise<ApiKey> {
    const now = Date.now();
    const result = await this.db
      .prepare('UPDATE api_keys SET quota_used = 0, last_reset_at = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(now, now, id)
      .run();

    if (!result.success) {
      throw new Error(`Failed to reset API key quota: ${result.error}`);
    }

    return this.getApiKey(id) as Promise<ApiKey>;
  }

  // ============================================
  // Provider Credential Operations
  // ============================================

  /**
   * Get active credentials for a provider
   *
   * PRD V2 Phase 1: Removed priority/weight (using consistent hash instead)
   *
   * @param providerId - Provider ID
   * @returns Array of active credentials
   */
  async getActiveCredentialsForProvider(providerId: string): Promise<ProviderCredential[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM provider_credentials
         WHERE provider_id = ?1 AND is_active = 1
         ORDER BY created_at DESC`
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
    base_url?: string | null;
    health_check_model_id?: string | null;
    health_status?: string;
    last_health_check?: number | null;
    last_check_success?: number | null;
    consecutive_failures?: number;
  }): Promise<ProviderCredential> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO provider_credentials (
          id, provider_id, credential_name, api_key_encrypted, base_url,
          is_active, health_check_model_id, health_status,
          last_health_check, last_check_success, consecutive_failures,
          created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
      )
      .bind(
        data.id,
        data.provider_id,
        data.credential_name,
        data.api_key_encrypted,
        data.base_url ?? null,
        true,
        data.health_check_model_id ?? null,
        data.health_status ?? 'unknown',
        data.last_health_check ?? null,
        data.last_check_success ?? null,
        data.consecutive_failures ?? 0,
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

  /**
   * Increment consecutive failures for health check tracking
   *
   * @param id - Credential ID
   * @returns Updated credential object
   */
  async incrementCredentialFailure(id: string): Promise<ProviderCredential> {
    const result = await this.db
      .prepare(
        'UPDATE provider_credentials SET consecutive_failures = consecutive_failures + 1, last_health_check = ?1, updated_at = ?2 WHERE id = ?3'
      )
      .bind(Date.now(), Date.now(), id)
      .run();

    if (!result.success) {
      throw new Error(`Failed to increment credential failures: ${result.error}`);
    }

    const updated = await this.getCredential(id);
    if (updated && updated.consecutive_failures >= 3) {
      // Auto-mark as unhealthy after 3 consecutive failures
      await this.updateCredentialHealth(id, 'unhealthy');
      return (await this.getCredential(id))!;
    }
    return updated!;
  }

  /**
   * Reset consecutive failures and record successful health check
   *
   * @param id - Credential ID
   * @returns Updated credential object
   */
  async recordCredentialSuccess(id: string): Promise<ProviderCredential> {
    const result = await this.db
      .prepare(
        `UPDATE provider_credentials
         SET consecutive_failures = 0,
             last_health_check = ?1,
             last_check_success = ?1,
             health_status = 'healthy',
             updated_at = ?1
         WHERE id = ?2`
      )
      .bind(Date.now(), id)
      .run();

    if (!result.success) {
      throw new Error(`Failed to record credential success: ${result.error}`);
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
  async createUsageLog(data: InternalCreateUsageLogDto): Promise<UsageLog> {
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

    // Skip SELECT query to avoid hanging in waitUntil() context.
    // We already have all the data, so just return the input.
    return data as UsageLog;
  }

  /**
   * Record a quota change
   *
   * @param data - Quota change data
   * @returns Created quota change record
   */
  async recordQuotaChange(data: InternalQuotaChangeDto): Promise<void> {
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

// ============================================
// Module-level function wrappers
// ============================================

/**
 * Module-level cache for Queries instances
 */
const queriesCache = new WeakMap<D1Database, Queries>();

/**
 * Get or create a Queries instance for a database
 */
function getQueries(db: D1Database): Queries {
  let instance = queriesCache.get(db);
  if (!instance) {
    instance = new Queries(db);
    queriesCache.set(db, instance);
  }
  return instance;
}

// Company operations
export const getCompany = (db: D1Database, id: string) => getQueries(db).getCompany(id);
export const getCompanyByName = (db: D1Database, name: string) => getQueries(db).getCompanyByName(name);
export const createCompany = (db: D1Database, data: InternalCreateCompanyDto) => getQueries(db).createCompany(data);
export const updateCompany = (db: D1Database, id: string, data: InternalUpdateCompanyDto) =>
  getQueries(db).updateCompany(id, data);
export const listCompanies = (db: D1Database) => getQueries(db).listCompanies();
export const deleteCompany = (db: D1Database, id: string) => getQueries(db).deleteCompany(id);

// Department operations
export const getDepartment = (db: D1Database, id: string) => getQueries(db).getDepartment(id);
export const listDepartmentsByCompany = (db: D1Database, companyId: string) =>
  getQueries(db).listDepartmentsByCompany(companyId);
export const listAllDepartments = (db: D1Database) => getQueries(db).listAllDepartments();
export const createDepartment = (db: D1Database, data: InternalCreateDepartmentDto) =>
  getQueries(db).createDepartment(data);
export const updateDepartment = (db: D1Database, id: string, data: InternalUpdateDepartmentDto) =>
  getQueries(db).updateDepartment(id, data);
export const deleteDepartment = (db: D1Database, id: string) => getQueries(db).deleteDepartment(id);

// User operations
export const getUser = (db: D1Database, id: string) => getQueries(db).getUser(id);
export const getUserByEmail = (db: D1Database, email: string) => getQueries(db).getUserByEmail(email);
export const listUsersByCompany = (db: D1Database, companyId: string) =>
  getQueries(db).listUsersByCompany(companyId);
export const listUsersByDepartment = (db: D1Database, departmentId: string) =>
  getQueries(db).listUsersByDepartment(departmentId);
export const listAllUsers = (db: D1Database) => getQueries(db).listAllUsers();
export const createUser = (db: D1Database, data: InternalCreateUserDto) => getQueries(db).createUser(data);
export const updateUser = (db: D1Database, id: string, data: InternalUpdateUserDto) =>
  getQueries(db).updateUser(id, data);
export const deleteUser = (db: D1Database, id: string) => getQueries(db).deleteUser(id);

// Provider operations
export const getProvider = (db: D1Database, id: string) => getQueries(db).getProvider(id);
export const getProviderByName = (db: D1Database, name: string) => getQueries(db).getProviderByName(name);
export const listActiveProviders = (db: D1Database) => getQueries(db).listActiveProviders();
export const listProviders = (db: D1Database) => getQueries(db).listProviders();
export const createProvider = (db: D1Database, data: InternalCreateProviderDto) => getQueries(db).createProvider(data);
export const updateProvider = (db: D1Database, id: string, data: InternalUpdateProviderDto) =>
  getQueries(db).updateProvider(id, data);
export const deleteProvider = (db: D1Database, id: string) => getQueries(db).deleteProvider(id);
export const getCheapestModelForProvider = (db: D1Database, providerId: string) =>
  getQueries(db).getCheapestModelForProvider(providerId);

// Model operations
export const getModel = (db: D1Database, id: string) => getQueries(db).getModel(id);
export const getModelByModelId = (db: D1Database, modelId: string) => getQueries(db).getModelByModelId(modelId);
export const getModelByAlias = (db: D1Database, alias: string) => getQueries(db).getModelByAlias(alias);
export const listActiveModels = (db: D1Database) => getQueries(db).listActiveModels();
export const listModels = (db: D1Database) => getQueries(db).listModels();
export const createModel = (db: D1Database, data: InternalCreateModelDto) => getQueries(db).createModel(data);
export const updateModel = (db: D1Database, id: string, data: InternalUpdateModelDto) =>
  getQueries(db).updateModel(id, data);
export const deleteModel = (db: D1Database, id: string) => getQueries(db).deleteModel(id);

// ModelProvider operations (n:n relationship)
export const getProvidersForModel = (db: D1Database, modelId: string) =>
  getQueries(db).getProvidersForModel(modelId);
export const getActiveProvidersForModel = (db: D1Database, modelId: string) =>
  getQueries(db).getActiveProvidersForModel(modelId);
export const getModelProvider = (db: D1Database, modelId: string, providerId: string) =>
  getQueries(db).getModelProvider(modelId, providerId);
export const addModelProvider = (
  db: D1Database,
  data: { id: string; model_id: string; provider_id: string; actual_model_id?: string | null; input_price: number; output_price: number }
) => getQueries(db).addModelProvider(data);
export const updateModelProvider = (
  db: D1Database,
  modelId: string,
  providerId: string,
  data: { input_price?: number; output_price?: number; is_active?: boolean }
) => getQueries(db).updateModelProvider(modelId, providerId, data);
export const removeModelProvider = (db: D1Database, modelId: string, providerId: string) =>
  getQueries(db).removeModelProvider(modelId, providerId);

// API Key operations
export const getApiKeyByKeyHash = (db: D1Database, keyHash: string) =>
  getQueries(db).getApiKeyByKeyHash(keyHash);
export const getApiKey = (db: D1Database, id: string) => getQueries(db).getApiKey(id);
export const listApiKeys = (
  db: D1Database,
  options: {
    user_id?: string;
    company_id?: string;
    department_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) => getQueries(db).listApiKeys(options);
export const createApiKey = (db: D1Database, data: InternalCreateApiKeyDto) => getQueries(db).createApiKey(data);
export const updateApiKey = (db: D1Database, id: string, data: InternalUpdateApiKeyDto) =>
  getQueries(db).updateApiKey(id, data);
export const deleteApiKey = (db: D1Database, id: string) => getQueries(db).deleteApiKey(id);
export const addApiKeyBonus = (
  db: D1Database,
  id: string,
  amountOrOptions: number | { amount: number; expires_at: number | null },
  expiry?: number
) => getQueries(db).addApiKeyBonus(id, amountOrOptions, expiry);
export const resetApiKeyQuota = (db: D1Database, id: string) => getQueries(db).resetApiKeyQuota(id);
export const cleanupExpiredBonus = (db: D1Database, id: string) => getQueries(db).cleanupExpiredBonus(id);

// Usage operations
export const createUsageLog = (db: D1Database, data: InternalCreateUsageLogDto) =>
  getQueries(db).createUsageLog(data);
export const recordQuotaChange = (db: D1Database, data: InternalQuotaChangeDto) =>
  getQueries(db).recordQuotaChange(data);
export const getUsageByTimeRange = (db: D1Database, companyId: string, startDate: number, endDate: number) =>
  getQueries(db).getUsageByTimeRange(companyId, startDate, endDate);
export const getUsageByModel = (db: D1Database, companyId: string, startDate: number, endDate: number) =>
  getQueries(db).getUsageByModel(companyId, startDate, endDate);
export const getQuotaChanges = (db: D1Database, entityType: string, entityId: string) =>
  getQueries(db).getQuotaChanges(entityType, entityId);
export const resetDailyQuota = (db: D1Database, entityType: string, entityId: string, resetTime: number) =>
  getQueries(db).resetDailyQuota(entityType, entityId, resetTime);

// Department model operations
export const getDepartmentModel = (db: D1Database, departmentId: string, modelId: string) =>
  getQueries(db).getDepartmentModel(departmentId, modelId);
export const listDepartmentModels = (db: D1Database, departmentId: string) =>
  getQueries(db).listAllowedModelsForDepartment(departmentId);
export const updateDepartmentModel = async (db: D1Database, id: string, data: {
  is_allowed?: boolean;
  daily_quota?: number;
}): Promise<void> => {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.is_allowed !== undefined) {
    updates.push(`is_allowed = ?${paramIndex++}`);
    params.push(data.is_allowed ? 1 : 0);
  }
  if (data.daily_quota !== undefined) {
    updates.push(`daily_quota = ?${paramIndex++}`);
    params.push(data.daily_quota);
  }

  if (updates.length === 0) return;

  params.push(id);
  await db.prepare(`UPDATE department_models SET ${updates.join(', ')} WHERE id = ?${paramIndex}`).bind(...params).run();
};
export const createDepartmentModel = (db: D1Database, data: any) =>
  getQueries(db).setDepartmentModelAccess(data);

// Provider credential operations
export const listProviderCredentials = (db: D1Database, providerId: string) =>
  getQueries(db).getActiveCredentialsForProvider(providerId);
export const getProviderCredential = (db: D1Database, id: string) =>
  getQueries(db).getCredential(id);
export const createProviderCredential = (db: D1Database, data: any) =>
  getQueries(db).createCredential(data);
export const deleteProviderCredential = async (db: D1Database, id: string): Promise<boolean> => {
  const result = await db.prepare('DELETE FROM provider_credentials WHERE id = ?1').bind(id).run();
  return result.success && (result.meta.rows_read ?? 0) > 0;
};
export const updateCredentialHealth = (db: D1Database, id: string, status: string) =>
  getQueries(db).updateCredentialHealth(id, status);
export const incrementCredentialFailure = (db: D1Database, id: string) =>
  getQueries(db).incrementCredentialFailure(id);
export const recordCredentialSuccess = (db: D1Database, id: string) =>
  getQueries(db).recordCredentialSuccess(id);

// Quota operations
export const resetUserQuota = async (db: D1Database, userId: string): Promise<void> => {
  await db.prepare('UPDATE users SET quota_used = 0, last_reset_at = ?1, updated_at = ?2 WHERE id = ?3')
    .bind(Date.now(), Date.now(), userId).run();
};
export const resetDepartmentQuota = async (db: D1Database, departmentId: string): Promise<void> => {
  await db.prepare('UPDATE departments SET daily_used = 0, quota_used = 0, last_reset_at = ?1, updated_at = ?2 WHERE id = ?3')
    .bind(Date.now(), Date.now(), departmentId).run();
};
export const resetCompanyQuota = async (db: D1Database, companyId: string): Promise<void> => {
  await db.prepare('UPDATE companies SET daily_used = 0, quota_used = 0, last_reset_at = ?1, updated_at = ?2 WHERE id = ?3')
    .bind(Date.now(), Date.now(), companyId).run();
};
export const deductApiKeyQuota = async (db: D1Database, apiKeyId: string, amount: number): Promise<ApiKey> => {
  await db.prepare('UPDATE api_keys SET quota_used = quota_used + ?1, updated_at = ?2 WHERE id = ?3')
    .bind(amount, Date.now(), apiKeyId).run();
  const result = await db.prepare('SELECT * FROM api_keys WHERE id = ?1').bind(apiKeyId).first<ApiKey>();
  if (!result) throw new Error(`API Key not found after deduction: ${apiKeyId}`);
  return result;
};

/**
 * Deducts from API Key quota with bonus fallback.
 *
 * Priority: Daily quota first, then bonus quota.
 *
 * @param db - D1 Database
 * @param apiKeyId - API Key ID
 * @param amount - Total amount to deduct
 * @returns Updated API Key
 */
export const deductApiKeyQuotaWithBonus = async (db: D1Database, apiKeyId: string, amount: number): Promise<ApiKey> => {
  const key = await db.prepare('SELECT * FROM api_keys WHERE id = ?1').bind(apiKeyId).first<ApiKey>();
  if (!key) throw new Error(`API Key not found: ${apiKeyId}`);

  const dailyRemaining = key.quota_daily - key.quota_used;
  let dailyDeduction = 0;
  let bonusDeduction = 0;

  if (dailyRemaining >= amount) {
    // Daily quota is sufficient
    dailyDeduction = amount;
  } else {
    // Use all remaining daily, then deduct from bonus
    dailyDeduction = dailyRemaining;
    bonusDeduction = amount - dailyRemaining;
  }

  // Build update query dynamically based on what needs to be deducted
  const updates: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (dailyDeduction > 0) {
    updates.push(`quota_used = quota_used + ?${paramIndex++}`);
    params.push(dailyDeduction);
  }

  if (bonusDeduction > 0) {
    updates.push(`quota_bonus_used = quota_bonus_used + ?${paramIndex++}`);
    params.push(bonusDeduction);
  }

  updates.push(`updated_at = ?${paramIndex++}`);
  params.push(Date.now());
  params.push(apiKeyId);

  const query = `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?${paramIndex}`;
  await db.prepare(query).bind(...params).run();

  const result = await db.prepare('SELECT * FROM api_keys WHERE id = ?1').bind(apiKeyId).first<ApiKey>();
  if (!result) throw new Error(`API Key not found after deduction: ${apiKeyId}`);
  return result;
};

export const deductUserQuota = async (db: D1Database, userId: string, amount: number): Promise<User> => {
  // Use MIN to prevent quota_used from exceeding quota_daily (overflow protection)
  await db.prepare('UPDATE users SET quota_used = MIN(quota_daily, quota_used + ?1), updated_at = ?2 WHERE id = ?3')
    .bind(amount, Date.now(), userId).run();
  const result = await db.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first<User>();
  if (!result) throw new Error(`User not found after deduction: ${userId}`);
  return result;
};
export const deductDepartmentDailyQuota = async (db: D1Database, departmentId: string, amount: number): Promise<Department> => {
  // Use MIN to prevent daily_used from exceeding quota_daily (overflow protection)
  await db.prepare('UPDATE departments SET daily_used = MIN(quota_daily, daily_used + ?1), updated_at = ?2 WHERE id = ?3')
    .bind(amount, Date.now(), departmentId).run();
  const result = await db.prepare('SELECT * FROM departments WHERE id = ?1').bind(departmentId).first<Department>();
  if (!result) throw new Error(`Department not found after deduction: ${departmentId}`);
  return result;
};
export const deductDepartmentMixedQuota = async (db: D1Database, departmentId: string, dailyAmount: number, poolAmount: number): Promise<Department> => {
  // Use MIN to prevent overflow (daily_used <= quota_daily, quota_used <= quota_pool)
  await db.prepare('UPDATE departments SET quota_used = MIN(quota_pool, quota_used + ?1), daily_used = MIN(quota_daily, daily_used + ?2), updated_at = ?3 WHERE id = ?4')
    .bind(poolAmount, dailyAmount, Date.now(), departmentId).run();
  const result = await db.prepare('SELECT * FROM departments WHERE id = ?1').bind(departmentId).first<Department>();
  if (!result) throw new Error(`Department not found after deduction: ${departmentId}`);
  return result;
};
export const deductCompanyDailyQuota = async (db: D1Database, companyId: string, amount: number): Promise<Company> => {
  // Use MIN to prevent daily_used from exceeding quota_daily (overflow protection)
  await db.prepare('UPDATE companies SET daily_used = MIN(quota_daily, daily_used + ?1), updated_at = ?2 WHERE id = ?3')
    .bind(amount, Date.now(), companyId).run();
  const result = await db.prepare('SELECT * FROM companies WHERE id = ?1').bind(companyId).first<Company>();
  if (!result) throw new Error(`Company not found after deduction: ${companyId}`);
  return result;
};
export const deductCompanyMixedQuota = async (db: D1Database, companyId: string, dailyAmount: number, poolAmount: number): Promise<Company> => {
  // Use MIN to prevent overflow (daily_used <= quota_daily, quota_used <= quota_pool)
  await db.prepare('UPDATE companies SET quota_used = MIN(quota_pool, quota_used + ?1), daily_used = MIN(quota_daily, daily_used + ?2), updated_at = ?3 WHERE id = ?4')
    .bind(poolAmount, dailyAmount, Date.now(), companyId).run();
  const result = await db.prepare('SELECT * FROM companies WHERE id = ?1').bind(companyId).first<Company>();
  if (!result) throw new Error(`Company not found after deduction: ${companyId}`);
  return result;
};
export const createQuotaChange = (db: D1Database, data: InternalQuotaChangeDto) =>
  getQueries(db).recordQuotaChange(data);

// Usage query operations
export const queryUsageLogs = async (db: D1Database, options: {
  search?: string;
  api_key_id?: string;
  user_id?: string;
  company_id?: string;
  department_id?: string;
  model_id?: string;
  status?: string;
  start_at?: number;
  end_at?: number;
  limit?: number;
  offset?: number;
}): Promise<{ logs: UsageLog[]; total: number }> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.search) {
    conditions.push(`(u.email LIKE ?${paramIndex++} OR u.name LIKE ?${paramIndex++})`);
    const searchPattern = `%${options.search}%`;
    params.push(searchPattern, searchPattern);
  }
  if (options.api_key_id) {
    conditions.push(`ul.api_key_id = ?${paramIndex++}`);
    params.push(options.api_key_id);
  }
  if (options.user_id) {
    conditions.push(`ul.user_id = ?${paramIndex++}`);
    params.push(options.user_id);
  }
  if (options.company_id) {
    conditions.push(`ul.company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }
  if (options.department_id) {
    conditions.push(`ul.department_id = ?${paramIndex++}`);
    params.push(options.department_id);
  }
  if (options.model_id) {
    conditions.push(`ul.model_id = ?${paramIndex++}`);
    params.push(options.model_id);
  }
  if (options.status) {
    conditions.push(`ul.status = ?${paramIndex++}`);
    params.push(options.status);
  }
  if (options.start_at) {
    conditions.push(`ul.created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`ul.created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  // First get count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM usage_logs ul LEFT JOIN users u ON ul.user_id = u.id ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();
  const total = countResult?.count ?? 0;

  // Then get the data with JOINs to get user email, company name, department name, provider name
  const result = await db
    .prepare(`
      SELECT ul.*,
        u.email as user_email,
        c.name as company_name,
        d.name as department_name,
        p.name as provider_name
      FROM usage_logs ul
      LEFT JOIN users u ON ul.user_id = u.id
      LEFT JOIN companies c ON ul.company_id = c.id
      LEFT JOIN departments d ON ul.department_id = d.id
      LEFT JOIN providers p ON ul.provider_id = p.id
      ${whereClause}
      ORDER BY ul.created_at DESC
      LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}
    `)
    .bind(...params, limit, offset)
    .all();

  return { logs: result.results as unknown as UsageLog[], total };
};
export const getUsageStats = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
  department_id?: string;
  user_id?: string;
  model_id?: string;
}): Promise<any> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }

  if (options.start_at) {
    conditions.push(`created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }
  if (options.department_id) {
    conditions.push(`department_id = ?${paramIndex++}`);
    params.push(options.department_id);
  }
  if (options.user_id) {
    conditions.push(`user_id = ?${paramIndex++}`);
    params.push(options.user_id);
  }
  if (options.model_id) {
    conditions.push(`model_id = ?${paramIndex++}`);
    params.push(options.model_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.prepare(
    `SELECT
      COUNT(*) as total_requests,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_requests,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(total_tokens * 0.00001) as estimated_cost
    FROM usage_logs ${whereClause}`
  ).bind(...params).first();
  return result;
};
export const getUsageStatsGrouped = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
  department_id?: string;
  user_id?: string;
  model_id?: string;
  group_by: string;
}): Promise<any[]> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }

  if (options.start_at) {
    conditions.push(`created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }
  if (options.department_id) {
    conditions.push(`department_id = ?${paramIndex++}`);
    params.push(options.department_id);
  }
  if (options.user_id) {
    conditions.push(`user_id = ?${paramIndex++}`);
    params.push(options.user_id);
  }
  if (options.model_id) {
    conditions.push(`model_id = ?${paramIndex++}`);
    params.push(options.model_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Handle different group_by options
  let selectClause: string;
  let groupByClause: string;

  if (options.group_by === 'day') {
    // Group by date: format timestamp as YYYY-MM-DD
    selectClause = `date(created_at / 1000, 'unixepoch') as group_key`;
    groupByClause = `date(created_at / 1000, 'unixepoch')`;
  } else if (options.group_by === 'model') {
    selectClause = `'model-' || model_id as group_key`;
    groupByClause = `model_id`;
  } else if (options.group_by === 'user') {
    selectClause = `user_id as group_key`;
    groupByClause = `user_id`;
  } else {
    // Default to provider
    selectClause = `provider_id as group_key`;
    groupByClause = `provider_id`;
  }

  const result = await db.prepare(
    `SELECT ${selectClause}, COUNT(*) as request_count, SUM(total_tokens) as total_tokens, SUM(total_tokens * 0.00001) as estimated_cost FROM usage_logs ${whereClause} GROUP BY ${groupByClause}`
  ).bind(...params).all();
  return result.results;
};
export const getTokenUsageSummary = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
  department_id?: string;
  user_id?: string;
}): Promise<any> => {
  const conditions: string[] = ["status = 'success'"];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }
  if (options.department_id) {
    conditions.push(`department_id = ?${paramIndex++}`);
    params.push(options.department_id);
  }
  if (options.user_id) {
    conditions.push(`user_id = ?${paramIndex++}`);
    params.push(options.user_id);
  }
  if (options.start_at) {
    conditions.push(`created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const result = await db.prepare(
    `SELECT SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, SUM(total_tokens) as total_tokens FROM usage_logs ${whereClause}`
  ).bind(...params).first();
  return result;
};
export const getTokenUsageByModel = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
  department_id?: string;
  user_id?: string;
}): Promise<any[]> => {
  const conditions: string[] = ["status = 'success'"];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }
  if (options.department_id) {
    conditions.push(`department_id = ?${paramIndex++}`);
    params.push(options.department_id);
  }
  if (options.user_id) {
    conditions.push(`user_id = ?${paramIndex++}`);
    params.push(options.user_id);
  }
  if (options.start_at) {
    conditions.push(`created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const result = await db.prepare(
    `SELECT model_id, model_name, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, SUM(total_tokens) as total_tokens, COUNT(*) as request_count FROM usage_logs ${whereClause} GROUP BY model_id, model_name ORDER BY total_tokens DESC`
  ).bind(...params).all();
  return result.results;
};
export const getTotalCost = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
}): Promise<{ total_cost: number }> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`u.company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }
  if (options.start_at) {
    conditions.push(`u.created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`u.created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.prepare(
    `SELECT SUM((u.input_tokens * COALESCE(mp.input_price, 0) + u.output_tokens * COALESCE(mp.output_price, 0)) / 1000) as total_cost FROM usage_logs u INNER JOIN model_providers mp ON u.model_id = mp.model_id AND u.provider_id = mp.provider_id ${whereClause}`
  ).bind(...params).first<{ total_cost: number }>();
  return { total_cost: result?.total_cost ?? 0 };
};
export const getCostByModel = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
}): Promise<any[]> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`u.company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }
  if (options.start_at) {
    conditions.push(`u.created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`u.created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.prepare(
    `SELECT u.model_name as model_id, u.model_name, SUM(u.input_tokens * COALESCE(mp.input_price, 0) / 1000) as input_cost, SUM(u.output_tokens * COALESCE(mp.output_price, 0) / 1000) as output_cost, SUM((u.input_tokens * COALESCE(mp.input_price, 0) + u.output_tokens * COALESCE(mp.output_price, 0)) / 1000) as total_cost FROM usage_logs u INNER JOIN model_providers mp ON u.model_id = mp.model_id AND u.provider_id = mp.provider_id ${whereClause} GROUP BY u.model_name`
  ).bind(...params).all();
  return result.results;
};
export const getCostByProvider = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
}): Promise<any[]> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`u.company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }
  if (options.start_at) {
    conditions.push(`u.created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`u.created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.prepare(
    `SELECT p.id as provider_id, p.name as provider_name, SUM((u.input_tokens * COALESCE(mp.input_price, 0) + u.output_tokens * COALESCE(mp.output_price, 0)) / 1000) as total_cost FROM usage_logs u INNER JOIN model_providers mp ON u.model_id = mp.model_id AND u.provider_id = mp.provider_id INNER JOIN providers p ON u.provider_id = p.id ${whereClause} GROUP BY p.id, p.name`
  ).bind(...params).all();
  return result.results;
};
export const getModelStats = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
}): Promise<any[]> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }
  if (options.start_at) {
    conditions.push(`created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.prepare(
    `SELECT model_name as model_id, model_name, COUNT(*) as requests, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, SUM(total_tokens) as total_tokens FROM usage_logs ${whereClause} GROUP BY model_name ORDER BY total_tokens DESC`
  ).bind(...params).all();
  return result.results;
};
export const getProviderModelStats = async (db: D1Database, options: {
  company_id?: string;
  start_at?: number;
  end_at?: number;
}): Promise<any[]> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.company_id) {
    conditions.push(`u.company_id = ?${paramIndex++}`);
    params.push(options.company_id);
  }
  if (options.start_at) {
    conditions.push(`u.created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`u.created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.prepare(
    `SELECT
      u.provider_id,
      p.name as provider_name,
      u.model_name as model_id,
      u.model_name,
      COUNT(*) as requests,
      SUM(u.input_tokens) as input_tokens,
      SUM(u.output_tokens) as output_tokens,
      SUM(u.total_tokens) as total_tokens
    FROM usage_logs u
    INNER JOIN providers p ON u.provider_id = p.id
    ${whereClause}
    GROUP BY u.provider_id, p.name, u.model_name
    ORDER BY total_tokens DESC`
  ).bind(...params).all();
  return result.results;
};
export const updateApiKeyLastUsed = (db: D1Database, apiKeyId: string) =>
  getQueries(db).updateApiKeyLastUsed(apiKeyId);

// ============================================
// Health Check Operations
// ============================================

/**
 * Get all active credentials for health checking
 *
 * Per PRD V2 Section 2.3.2: Automatically select the cheapest model for health checks
 *
 * @param db - D1 Database
 * @returns Array of all active credentials with provider info
 */
export const getAllActiveCredentials = async (db: D1Database): Promise<Array<{
  id: string;
  provider_id: string;
  credential_name: string;
  api_key_encrypted: string;
  base_url: string | null;
  health_status: string;
  provider_name: string;
  provider_base_url: string;
  /** Internal model ID (cheapest active model for this provider), null if no active models */
  health_check_model_id: string | null;
  /** Upstream model name (cheapest active model for this provider), null if no active models */
  health_check_model_name: string | null;
}>> => {
  const result = await db.prepare(`
    SELECT
      pc.id,
      pc.provider_id,
      pc.credential_name,
      pc.api_key_encrypted,
      pc.base_url,
      pc.health_status,
      p.name as provider_name,
      p.base_url as provider_base_url,
      (
        SELECT m.id
        FROM model_providers mp
        INNER JOIN models m ON mp.model_id = m.id
        WHERE mp.provider_id = p.id AND mp.is_active = 1 AND m.is_active = 1
        ORDER BY mp.input_price ASC
        LIMIT 1
      ) as health_check_model_id,
      (
        SELECT COALESCE(mp.actual_model_id, m.model_id)
        FROM model_providers mp
        INNER JOIN models m ON mp.model_id = m.id
        WHERE mp.provider_id = p.id AND mp.is_active = 1 AND m.is_active = 1
        ORDER BY mp.input_price ASC
        LIMIT 1
      ) as health_check_model_name
    FROM provider_credentials pc
    INNER JOIN providers p ON pc.provider_id = p.id
    WHERE pc.is_active = 1 AND p.is_active = 1
    ORDER BY pc.created_at ASC
  `).all();
  return result.results as any;
};

/**
 * Get health check statistics for a time period
 *
 * @param db - D1 Database
 * @param options - Query options
 * @returns Health check statistics
 */
export const getHealthCheckStats = async (db: D1Database, options: {
  start_at?: number;
  end_at?: number;
}): Promise<{
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  total_tokens_used: number;
}> => {
  const conditions: string[] = [
    'api_key_id = (SELECT id FROM api_keys WHERE user_id = ?1 LIMIT 1)'
  ];
  const params: any[] = ['sys-health-user'];

  let paramIndex = 2;
  if (options.start_at) {
    conditions.push(`created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const result = await db.prepare(`
    SELECT
      COUNT(*) as total_checks,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_checks,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_checks,
      SUM(total_tokens) as total_tokens_used
    FROM usage_logs
    ${whereClause}
  `).bind(...params).first();

  return {
    total_checks: (result?.['total_checks'] as number) ?? 0,
    successful_checks: (result?.['successful_checks'] as number) ?? 0,
    failed_checks: (result?.['failed_checks'] as number) ?? 0,
    total_tokens_used: (result?.['total_tokens_used'] as number) ?? 0,
  };
};

/**
 * Get health check usage logs
 *
 * @param db - D1 Database
 * @param options - Query options
 * @returns Paginated health check usage logs
 */
export const getHealthCheckUsageLogs = async (db: D1Database, options: {
  start_at?: number;
  end_at?: number;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: Array<{
    id: string;
    provider_id: string;
    model_name: string;
    status: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    error_code: string | null;
    created_at: number;
  }>;
  total: number;
}> => {
  const conditions: string[] = [
    'api_key_id = (SELECT id FROM api_keys WHERE user_id = ?1 LIMIT 1)'
  ];
  const params: any[] = ['sys-health-user'];

  let paramIndex = 2;
  if (options.start_at) {
    conditions.push(`created_at >= ?${paramIndex++}`);
    params.push(options.start_at);
  }
  if (options.end_at) {
    conditions.push(`created_at <= ?${paramIndex++}`);
    params.push(options.end_at);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  // Get total count
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM usage_logs ${whereClause}
  `).bind(...params).first();
  const total = (countResult?.['total'] as number) ?? 0;

  // Get logs
  params.push(limit, offset);
  const logsResult = await db.prepare(`
    SELECT
      id,
      provider_id,
      model_name,
      status,
      input_tokens,
      output_tokens,
      total_tokens,
      error_code,
      created_at
    FROM usage_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}
  `).bind(...params).all();

  return {
    logs: (logsResult.results ?? []) as Array<{
      id: string;
      provider_id: string;
      model_name: string;
      status: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      error_code: string | null;
      created_at: number;
    }>,
    total,
  };
};

/**
 * Get all credentials health status
 *
 * @param db - D1 Database
 * @returns Array of credentials with health status
 */
export const getAllCredentialsHealthStatus = async (db: D1Database): Promise<Array<{
  id: string;
  provider_id: string;
  provider_name: string;
  credential_name: string;
  health_status: string;
  last_health_check: number | null;
  is_active: boolean;
}>> => {
  const result = await db.prepare(`
    SELECT
      pc.id,
      pc.provider_id,
      p.name as provider_name,
      pc.credential_name,
      pc.health_status,
      pc.last_health_check,
      pc.is_active
    FROM provider_credentials pc
    INNER JOIN providers p ON pc.provider_id = p.id
    ORDER BY pc.is_active DESC, pc.last_health_check DESC NULLS LAST
  `).all();

  return result.results.map((row: any) => ({
    ...row,
    is_active: Boolean(row.is_active),
  }));
};

/**
 * Get system user quota info
 *
 * @param db - D1 Database
 * @returns System user quota information
 */
export const getSystemUserQuota = async (db: D1Database): Promise<{
  quota_daily: number;
  quota_used: number;
  quota_remaining: number;
} | null> => {
  const result = await db.prepare(`
    SELECT quota_daily, quota_used
    FROM users
    WHERE id = ?1
  `).bind('sys-health-user').first<{ quota_daily: number; quota_used: number }>();

  if (!result) return null;

  return {
    quota_daily: result.quota_daily,
    quota_used: result.quota_used,
    quota_remaining: result.quota_daily - result.quota_used,
  };
};

// ============================================
// Type Aliases for backward compatibility
// These re-export internal DTOs with public names for API compatibility
// ============================================
export type CreateCompanyDto = InternalCreateCompanyDto;
export type UpdateCompanyDto = InternalUpdateCompanyDto;
export type CreateDepartmentDto = InternalCreateDepartmentDto;
export type UpdateDepartmentDto = InternalUpdateDepartmentDto;
export type CreateUserDto = InternalCreateUserDto;
export type UpdateUserDto = InternalUpdateUserDto;
export type CreateProviderDto = InternalCreateProviderDto;
export type UpdateProviderDto = InternalUpdateProviderDto;
export type CreateModelDto = InternalCreateModelDto;
export type UpdateModelDto = InternalUpdateModelDto;
export type CreateApiKeyDto = InternalCreateApiKeyDto;
export type UpdateApiKeyDto = InternalUpdateApiKeyDto;
export type CreateUsageLogDto = InternalCreateUsageLogDto;
export type QuotaChangeDto = InternalQuotaChangeDto;
