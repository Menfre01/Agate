/**
 * API Key Management Service.
 *
 * Handles CRUD operations for API Keys including creation,
 * listing, updating, disabling, and bonus quota management.
 *
 * @module services/key
 */

import type {
  ApiKey,
  User,
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyResponse,
  AddBonusQuotaDto,
  Env,
} from "@/types/index.js";
import { AuthService } from "./auth.service.js";
import * as queries from "@/db/queries.js";
import { generateId } from "@/utils/id-generator.js";
import { NotFoundError, ValidationError } from "@/utils/errors/index.js";

/**
 * API Key Management Service class.
 *
 * @example
 * ```ts
 * const keyService = new KeyService(env);
 *
 * // Create a new API key
 * const { key, response } = await keyService.createApiKey({
 *   user_id: "user-123",
 *   name: "Production Key",
 *   quota_daily: 10000,
 * });
 * ```
 */
export class KeyService {
  private readonly db: D1Database;
  private readonly authService: AuthService;

  /**
   * Creates a new KeyService instance.
   *
   * @param env - Cloudflare Workers environment
   */
  constructor(env: Env) {
    this.db = env.DB;
    this.authService = new AuthService(env);
  }

  /**
   * Lists API Keys with optional filtering.
   *
   * @param options - Query options
   * @returns Array of API Key responses
   */
  async listApiKeys(options: {
    /** Filter by user ID */
    user_id?: string;
    /** Filter by company ID */
    company_id?: string;
    /** Filter by department ID */
    department_id?: string;
    /** Include only active keys */
    is_active?: boolean;
    /** Maximum results to return */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
  } = {}): Promise<ApiKeyResponse[]> {
    const keys = await queries.listApiKeys(this.db, {
      user_id: options.user_id,
      company_id: options.company_id,
      department_id: options.department_id,
      is_active: options.is_active,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    });

    // Fetch user emails for each key
    const userIds = Array.from(new Set(keys.map((k) => k.user_id)));
    const users = await this.fetchUsers(userIds);

    return keys.map((key) => this.toResponse(key, users.get(key.user_id)));
  }

  /**
   * Creates a new API Key.
   *
   * @param dto - Create API Key data
   * @returns Created API Key (raw key only returned on creation)
   * @throws {ValidationError} If validation fails
   */
  async createApiKey(dto: CreateApiKeyDto): Promise<{
    /** Raw API key (only available on creation) */
    key: string;
    /** API Key response data */
    response: ApiKeyResponse;
  }> {
    // Validate user exists
    const user = await queries.getUser(this.db, dto.user_id);
    if (!user) {
      throw new ValidationError("User not found", { user_id: dto.user_id });
    }

    // Validate quota_daily
    if (dto.quota_daily < 0) {
      throw new ValidationError("Daily quota must be non-negative", {
        quota_daily: String(dto.quota_daily),
      });
    }

    // Validate expires_at if provided
    if (dto.expires_at && dto.expires_at < Date.now()) {
      throw new ValidationError("Expiry date must be in the future", {
        expires_at: String(dto.expires_at),
      });
    }

    // Generate API key
    const rawKey = this.authService.generateApiKey();
    const keyHash = await this.authService.hashApiKey(rawKey);
    const keyPrefix = this.authService.extractKeyPrefix(rawKey);

    const now = Date.now();
    // quota_daily=0 表示无限配额
    const isUnlimited = dto.quota_daily === 0;
    const apiKey: ApiKey = {
      id: generateId(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
      user_id: dto.user_id,
      company_id: user.company_id,
      department_id: user.department_id,
      name: dto.name,
      quota_daily: dto.quota_daily,
      quota_used: 0,
      quota_bonus: 0,
      quota_bonus_expiry: null,
      is_unlimited: isUnlimited,
      is_active: true,
      last_reset_at: now,
      last_used_at: null,
      expires_at: dto.expires_at ?? null,
      created_at: now,
      updated_at: now,
    };

    await queries.createApiKey(this.db, apiKey);

    return {
      key: rawKey,
      response: this.toResponse(apiKey, user),
    };
  }

  /**
   * Gets an API Key by ID.
   *
   * @param id - API Key ID
   * @returns API Key response
   * @throws {NotFoundError} If key not found
   */
  async getApiKey(id: string): Promise<ApiKeyResponse> {
    const key = await queries.getApiKey(this.db, id);
    if (!key) {
      throw new NotFoundError("API Key", id);
    }

    const user = await queries.getUser(this.db, key.user_id);
    return this.toResponse(key, user);
  }

  /**
   * Updates an API Key.
   *
   * @param id - API Key ID
   * @param dto - Update data
   * @returns Updated API Key response
   * @throws {NotFoundError} If key not found
   */
  async updateApiKey(id: string, dto: UpdateApiKeyDto): Promise<ApiKeyResponse> {
    const existing = await queries.getApiKey(this.db, id);
    if (!existing) {
      throw new NotFoundError("API Key", id);
    }

    // If changing is_active, invalidate cache
    if (dto.is_active !== undefined && dto.is_active !== existing.is_active) {
      await this.authService.invalidateApiKey(existing.key_hash);
    }

    // Validate quota_daily if provided
    if (dto.quota_daily !== undefined && dto.quota_daily < 0) {
      throw new ValidationError("Daily quota must be non-negative", {
        quota_daily: String(dto.quota_daily),
      });
    }

    const updated = await queries.updateApiKey(this.db, id, {
      name: dto.name,
      quota_daily: dto.quota_daily,
      is_active: dto.is_active,
      expires_at: dto.expires_at,
      updated_at: Date.now(),
    });

    const user = await queries.getUser(this.db, updated.user_id);
    return this.toResponse(updated, user);
  }

  /**
   * Deletes an API Key.
   *
   * @param id - API Key ID
   * @throws {NotFoundError} If key not found
   */
  async deleteApiKey(id: string): Promise<void> {
    const existing = await queries.getApiKey(this.db, id);
    if (!existing) {
      throw new NotFoundError("API Key", id);
    }

    // Invalidate cache before deleting
    await this.authService.invalidateApiKey(existing.key_hash);

    await queries.deleteApiKey(this.db, id);
  }

  /**
   * Disables an API Key.
   *
   * @param id - API Key ID
   * @returns Updated API Key response
   * @throws {NotFoundError} If key not found
   */
  async disableApiKey(id: string): Promise<ApiKeyResponse> {
    return this.updateApiKey(id, { is_active: false });
  }

  /**
   * Enables an API Key.
   *
   * @param id - API Key ID
   * @returns Updated API Key response
   * @throws {NotFoundError} If key not found
   */
  async enableApiKey(id: string): Promise<ApiKeyResponse> {
    return this.updateApiKey(id, { is_active: true });
  }

  /**
   * Adds bonus quota to an API Key.
   *
   * @param id - API Key ID
   * @param dto - Bonus quota data
   * @returns Updated API Key response
   * @throws {NotFoundError} If key not found
   */
  async addBonusQuota(
    id: string,
    dto: AddBonusQuotaDto
  ): Promise<ApiKeyResponse> {
    const existing = await queries.getApiKey(this.db, id);
    if (!existing) {
      throw new NotFoundError("API Key", id);
    }

    // Validate bonus amount
    if (dto.amount <= 0) {
      throw new ValidationError("Bonus amount must be positive", {
        amount: String(dto.amount),
      });
    }

    // Validate expiry if provided
    if (dto.expires_at && dto.expires_at < Date.now()) {
      throw new ValidationError("Expiry date must be in the future", {
        expires_at: String(dto.expires_at),
      });
    }

    const updated = await queries.addApiKeyBonus(this.db, id, {
      amount: dto.amount,
      expires_at: dto.expires_at ?? null,
    });

    const user = await queries.getUser(this.db, updated.user_id);

    // Invalidate cache to refresh quota data
    await this.authService.invalidateApiKey(existing.key_hash);

    return this.toResponse(updated, user);
  }

  /**
   * Resets API Key quota usage.
   *
   * @param id - API Key ID
   * @returns Updated API Key response
   * @throws {NotFoundError} If key not found
   */
  async resetQuota(id: string): Promise<ApiKeyResponse> {
    const existing = await queries.getApiKey(this.db, id);
    if (!existing) {
      throw new NotFoundError("API Key", id);
    }

    const updated = await queries.resetApiKeyQuota(this.db, id);
    const user = await queries.getUser(this.db, updated.user_id);

    // Invalidate cache
    await this.authService.invalidateApiKey(existing.key_hash);

    return this.toResponse(updated, user);
  }

  /**
   * Fetches multiple users by IDs.
   *
   * @param userIds - Array of user IDs
   * @returns Map of user ID to User entity
   */
  private async fetchUsers(userIds: string[]): Promise<Map<string, User>> {
    const users: User[] = [];
    for (const id of userIds) {
      const user = await queries.getUser(this.db, id);
      if (user) {
        users.push(user);
      }
    }
    return new Map(users.map((u) => [u.id, u]));
  }

  /**
   * Converts ApiKey entity to API response.
   *
   * @param key - ApiKey entity
   * @param user - Associated User entity (optional)
   * @returns API Key response DTO
   */
  private toResponse(key: ApiKey, user?: User | null): ApiKeyResponse {
    return {
      id: key.id,
      key_prefix: key.key_prefix,
      user_id: key.user_id,
      user_email: user?.email ?? "",
      company_id: key.company_id,
      department_id: key.department_id,
      name: key.name,
      quota_daily: key.quota_daily,
      quota_used: key.quota_used,
      quota_bonus: key.quota_bonus,
      is_unlimited: Boolean(key.is_unlimited),
      is_active: Boolean(key.is_active),
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      created_at: key.created_at,
    };
  }
}
