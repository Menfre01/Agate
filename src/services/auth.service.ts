/**
 * Authentication Service for API Key validation.
 *
 * Validates API Keys using a cache-first strategy for performance.
 * Falls back to D1 database on cache miss.
 *
 * @module services/auth
 */

import type {
  ApiKey,
  AuthContext,
  User,
  Company,
  Department,
  Env,
} from "@/types/index.js";
import { CacheService } from "./cache.service.js";
import * as queries from "@/db/queries.js";
import { UnauthorizedError } from "@/utils/errors/index.js";
import { hashApiKey, extractKeyPrefix } from "@/utils/crypto.js";

/**
 * API Key format validation.
 */
const API_KEY_PREFIX = "sk-";
const API_KEY_MIN_LENGTH = 20;

/**
 * Authentication Service class.
 *
 * @example
 * ```ts
 * const auth = new AuthService(env);
 * const context = await auth.validateApiKey("sk_test_123");
 * ```
 */
export class AuthService {
  private readonly cache: CacheService;
  private readonly db: D1Database;

  /**
   * Creates a new AuthService instance.
   *
   * @param env - Cloudflare Workers environment
   */
  constructor(env: Env) {
    this.cache = new CacheService(env.CACHE);
    this.db = env.DB;
  }

  /**
   * Validates an API Key and returns authentication context.
   *
   * Uses cache-first strategy:
   * 1. Check KV cache for valid key
   * 2. On cache miss, query D1 database
   * 3. Update cache with fresh data
   *
   * @param apiKey - Raw API key from request header
   * @returns Authentication context with user and organization info
   * @throws {UnauthorizedError} If key is invalid, disabled, or expired
   */
  async validateApiKey(apiKey: string): Promise<AuthContext> {
    // Validate key format
    if (!this.isValidApiKeyFormat(apiKey)) {
      throw new UnauthorizedError("Invalid API key format");
    }

    // Compute hash for lookup
    const keyHash = await hashApiKey(apiKey);

    // Try cache first
    const cached = await this.cache.getApiKey(keyHash);
    if (cached) {
      return this.buildAuthContextFromCache(cached);
    }

    // Cache miss - query database
    const keyData = await queries.getApiKeyByKeyHash(this.db, keyHash);
    if (!keyData) {
      throw new UnauthorizedError("Invalid API key");
    }

    // Check if key is active
    if (!keyData.is_active) {
      throw new UnauthorizedError("API key is disabled");
    }

    // Check if key is expired
    if (keyData.expires_at && keyData.expires_at < Date.now()) {
      throw new UnauthorizedError("API key has expired");
    }

    // Cache the validated key
    await this.cache.setApiKey(keyHash, keyData);

    // Build full auth context with user and company info
    return await this.buildAuthContext(keyData);
  }

  /**
   * Validates API Key format without database lookup.
   *
   * @param apiKey - Raw API key to validate
   * @returns true if format is valid
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== "string") {
      return false;
    }

    // Check prefix
    if (!apiKey.startsWith(API_KEY_PREFIX)) {
      return false;
    }

    // Check minimum length
    if (apiKey.length < API_KEY_MIN_LENGTH) {
      return false;
    }

    return true;
  }

  /**
   * Builds AuthContext from cached API Key data.
   *
   * Only includes data available in cache for performance.
   * For full context, use buildAuthContext.
   *
   * @param cached - Cached API Key data
   * @returns Authentication context
   */
  private buildAuthContextFromCache(cached: {
    id: string;
    user_id: string;
    company_id: string;
    department_id: string | null;
    quota_daily: number;
    quota_used: number;
    quota_bonus: number;
    quota_bonus_expiry: number | null;
    is_unlimited: boolean;
    is_active: boolean;
    expires_at: number | null;
  }): AuthContext {
    return {
      apiKeyId: cached.id,
      userId: cached.user_id,
      userEmail: "", // Not in cache, populated on full lookup
      userName: null,
      userRole: "user", // Default, populated on full lookup
      companyId: cached.company_id,
      companyName: "", // Not in cache
      departmentId: cached.department_id,
      departmentName: null,
      quotaDaily: cached.quota_daily,
      quotaUsed: cached.quota_used,
      quotaBonus: cached.quota_bonus,
      quotaBonusExpiry: cached.quota_bonus_expiry,
      isUnlimited: cached.is_unlimited,
      isActive: cached.is_active,
      expiresAt: cached.expires_at,
    };
  }

  /**
   * Builds complete AuthContext with user and organization info.
   *
   * @param keyData - API Key entity from database
   * @returns Complete authentication context
   */
  private async buildAuthContext(keyData: ApiKey): Promise<AuthContext> {
    // Fetch user and company data
    const [user, company] = await Promise.all([
      queries.getUser(this.db, keyData.user_id),
      queries.getCompany(this.db, keyData.company_id),
    ]);

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    if (!company) {
      throw new UnauthorizedError("Company not found");
    }

    // Fetch department if applicable
    let department: Department | null = null;
    if (keyData.department_id) {
      department = await queries.getDepartment(this.db, keyData.department_id);
    }

    return {
      apiKeyId: keyData.id,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role as "admin" | "user",
      companyId: company.id,
      companyName: company.name,
      departmentId: keyData.department_id,
      departmentName: department?.name ?? null,
      quotaDaily: keyData.quota_daily,
      quotaUsed: keyData.quota_used,
      quotaBonus: keyData.quota_bonus,
      quotaBonusExpiry: keyData.quota_bonus_expiry,
      isUnlimited: keyData.is_unlimited,
      isActive: keyData.is_active,
      expiresAt: keyData.expires_at,
    };
  }

  /**
   * Invalidates cached API Key data.
   *
   * Call this when an API Key is modified, disabled, or deleted.
   *
   * @param keyHash - SHA-256 hash of the API key
   */
  async invalidateApiKey(keyHash: string): Promise<void> {
    await this.cache.deleteApiKey(keyHash);
  }

  /**
   * Generates a new API Key.
   *
   * @returns Generated API key string
   */
  generateApiKey(): string {
    return `sk_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}`;
  }

  /**
   * Extracts safe prefix from API Key for display.
   *
   * @param apiKey - Raw API key
   * @returns Safe prefix string
   */
  extractKeyPrefix(apiKey: string): string {
    return extractKeyPrefix(apiKey);
  }

  /**
   * Computes hash of an API Key.
   *
   * @param apiKey - Raw API key
   * @returns Hex-encoded SHA-256 hash
   */
  async hashApiKey(apiKey: string): Promise<string> {
    return hashApiKey(apiKey);
  }
}
