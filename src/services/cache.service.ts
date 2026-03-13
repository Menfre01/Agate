/**
 * Cache Service for KV-based caching layer.
 *
 * Provides caching for API Key authentication and frequently accessed data.
 * Uses Cloudflare KV with TTL-based expiration.
 *
 * @module services/cache
 */

import type { ApiKey } from "@/types/index.js";

/**
 * Cache TTL configuration (in seconds).
 */
export const CACHE_TTL = {
  /** API Key cache TTL - 5 minutes */
  API_KEY: 300,
  /** Short-lived cache - 1 minute */
  SHORT: 60,
  /** Long-lived cache - 1 hour */
  LONG: 3600,
} as const;

/**
 * KV key prefixes for namespacing.
 */
const KEY_PREFIX = {
  /** API Key authentication cache */
  AUTH: "auth:key",
} as const;

/**
 * Cached API Key data (subset of ApiKey entity).
 */
export interface CachedApiKey {
  /** API Key ID */
  id: string;
  /** Key prefix */
  key_prefix: string;
  /** User ID */
  user_id: string;
  /** User role (admin/user) */
  user_role: string;
  /** User email */
  user_email: string;
  /** User name */
  user_name: string;
  /** Company ID */
  company_id: string;
  /** Company name */
  company_name: string;
  /** Department ID */
  department_id: string | null;
  /** Department name */
  department_name: string | null;
  /** Key name */
  name: string | null;
  /** Daily quota */
  quota_daily: number;
  /** Quota used */
  quota_used: number;
  /** Bonus quota */
  quota_bonus: number;
  /** Bonus expiry */
  quota_bonus_expiry: number | null;
  /** Unlimited flag */
  is_unlimited: boolean;
  /** Active flag */
  is_active: boolean;
  /** Last reset timestamp */
  last_reset_at: number | null;
  /** Expiry timestamp */
  expires_at: number | null;
}

/**
 * Cache Service class.
 *
 * @example
 * ```ts
 * const cache = new CacheService(env.CACHE);
 *
 * // Cache API key
 * await cache.setApiKey(keyHash, apiKeyData);
 *
 * // Retrieve cached API key
 * const cached = await cache.getApiKey(keyHash);
 * ```
 */
export class CacheService {
  /** KV namespace binding */
  private readonly kv: KVNamespace;

  /**
   * Creates a new CacheService instance.
   *
   * @param kv - Cloudflare KV namespace
   */
  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Generates the cache key for an API Key hash.
   *
   * @param keyHash - SHA-256 hash of the API key
   * @returns KV storage key
   */
  private apiKeyKey(keyHash: string): string {
    return `${KEY_PREFIX.AUTH}:${keyHash}`;
  }

  /**
   * Caches API Key data with TTL.
   *
   * @param keyHash - SHA-256 hash of the API key
   * @param apiKey - API Key entity to cache
   * @param user - User entity for additional context
   * @param company - Company entity for additional context
   * @param department - Department entity (optional)
   * @param ttl - Time-to-live in seconds (default: API_KEY_TTL)
   */
  async setApiKey(
    keyHash: string,
    apiKey: ApiKey,
    user: { id: string; email: string; name: string; role: string },
    company: { id: string; name: string },
    department: { id: string; name: string } | null,
    ttl: number = CACHE_TTL.API_KEY
  ): Promise<void> {
    const key = this.apiKeyKey(keyHash);
    const cached: CachedApiKey = {
      id: apiKey.id,
      key_prefix: apiKey.key_prefix,
      user_id: apiKey.user_id,
      user_role: user.role,
      user_email: user.email,
      user_name: user.name,
      company_id: apiKey.company_id,
      company_name: company.name,
      department_id: apiKey.department_id,
      department_name: department?.name ?? null,
      name: apiKey.name,
      quota_daily: apiKey.quota_daily,
      quota_used: apiKey.quota_used,
      quota_bonus: apiKey.quota_bonus,
      quota_bonus_expiry: apiKey.quota_bonus_expiry,
      is_unlimited: apiKey.is_unlimited,
      is_active: apiKey.is_active,
      last_reset_at: apiKey.last_reset_at,
      expires_at: apiKey.expires_at,
    };

    await this.kv.put(key, JSON.stringify(cached), {
      expirationTtl: ttl,
    });
  }

  /**
   * Retrieves cached API Key data.
   *
   * @param keyHash - SHA-256 hash of the API key
   * @returns Cached API Key data, or null if not found/expired
   */
  async getApiKey(keyHash: string): Promise<CachedApiKey | null> {
    const key = this.apiKeyKey(keyHash);
    const value = await this.kv.get(key, "text");

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as CachedApiKey;
    } catch {
      // Invalid JSON - treat as cache miss
      return null;
    }
  }

  /**
   * Deletes cached API Key data.
   *
   * Use this when an API Key is disabled, deleted, or modified.
   *
   * @param keyHash - SHA-256 hash of the API key
   */
  async deleteApiKey(keyHash: string): Promise<void> {
    const key = this.apiKeyKey(keyHash);
    await this.kv.delete(key);
  }

  /**
   * Caches arbitrary data with a custom key.
   *
   * @param prefix - Key prefix for namespacing
   * @param key - Unique key within the prefix
   * @param value - Data to cache (must be JSON-serializable)
   * @param ttl - Time-to-live in seconds
   */
  async set<T>(
    prefix: string,
    key: string,
    value: T,
    ttl: number
  ): Promise<void> {
    const fullKey = `${prefix}:${key}`;
    await this.kv.put(fullKey, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  }

  /**
   * Retrieves cached arbitrary data.
   *
   * @param prefix - Key prefix for namespacing
   * @param key - Unique key within the prefix
   * @returns Cached data, or null if not found/expired
   */
  async get<T>(prefix: string, key: string): Promise<T | null> {
    const fullKey = `${prefix}:${key}`;
    const value = await this.kv.get(fullKey, "text");

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Deletes cached data by key pattern.
   *
   * Note: KV does not support pattern-based deletion.
   * This method requires exact key match.
   *
   * @param prefix - Key prefix for namespacing
   * @param key - Unique key within the prefix
   */
  async delete(prefix: string, key: string): Promise<void> {
    const fullKey = `${prefix}:${key}`;
    await this.kv.delete(fullKey);
  }
}
