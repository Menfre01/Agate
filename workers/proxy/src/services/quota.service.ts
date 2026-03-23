/**
 * Quota Service for quota checking and deduction (Proxy Worker - Phase 1).
 *
 * @module services/quota
 *
 * ## Phase 1 vs Phase 2 Functionality
 *
 * ### Phase 1 (Main Line 1: LLM Load Balancing + API Key Management)
 * - Only enforces quota for system user (sys-health-user)
 * - Regular users bypass quota checks (treated as unlimited)
 * - Health check worker records usage but doesn't enforce limits for normal users
 *
 * ### Phase 2 (Main Line 2: Token Monitoring System) - FUTURE
 * - Implements multi-level quota validation: API Key → User → Department → Company
 * - Supports both daily quota (auto-reset) and pool quota (manual refill)
 * - Real-time monitoring, alerts, and cost analysis
 *
 * @see PRD V2 Section 3 - Phase separation
 */

import type {
  ApiKey,
  User,
  Company,
  Department,
  Env,
} from "@agate/shared/types";
import * as queries from "@agate/shared/db/queries.js";

/**
 * System user ID for health checks
 * @see PRD V2 Section 2.4.3
 */
const SYSTEM_USER_ID = "sys-health-user";

/**
 * Quota check result (Phase 1 simplified).
 */
export interface QuotaCheckResult {
  /** Whether quota check passed */
  allowed: boolean;
  /** Remaining tokens for system user (always Infinity for non-system users) */
  remaining: number;
}

/**
 * Quota deduction result (Phase 1 simplified).
 */
export interface QuotaDeductionResult {
  /** Tokens deducted */
  tokens: number;
  /** Updated user quota_used (only for system user) */
  quotaUsed: number;
}

/**
 * Quota Service class for Proxy Worker (Phase 1).
 *
 * @example
 * ```ts
 * const quota = new QuotaService(env);
 *
 * // Check quota before request (always true for non-system users)
 * const check = await quota.checkQuota(user, 1000);
 * if (!check.allowed) {
 *   throw new QuotaExceededError("System user quota exceeded");
 * }
 *
 * // Deduct after successful request (only for system user)
 * await quota.deductQuota(userId, 1000);
 * ```
 */
export class QuotaService {
  private readonly db: D1Database;

  /**
   * Creates a new QuotaService instance.
   *
   * @param env - Cloudflare Workers environment
   */
  constructor(env: Env) {
    this.db = env.DB;
  }

  /**
   * Checks if a request is within quota limits (Phase 1 simplified).
   *
   * **Phase 1 Logic:**
   * - Only enforces quota for system user (sys-health-user) for health check protection
   * - All other users bypass quota checks
   *
   * **Phase 2 (Future):**
   * - Will implement multi-level quota: API Key → User → Department → Company
   *
   * @param user - User entity
   * @param tokens - Token cost of the request
   * @returns Quota check result (always true for non-system users in Phase 1)
   *
   * @see PRD V2 Section 2.4 - System User Quota Protection
   */
  async checkQuota(
    user: User,
    tokens: number
  ): Promise<QuotaCheckResult> {
    // Phase 1: Only check system user quota
    if (user.id === SYSTEM_USER_ID || user.role === "system") {
      return this.checkSystemUserQuota(user, tokens);
    }

    // Phase 1: All other users bypass quota checks
    // TODO: Phase 2 - Implement full multi-level quota validation
    return {
      allowed: true,
      remaining: Infinity,
    };
  }

  /**
   * Checks system user quota for health check protection.
   *
   * **Phase 1 - Health Check Quota Protection:**
   * - Enforces daily quota limit for system user
   * - Prevents health check storms from bugs
   * - Logs warning when quota > 80%
   *
   * @param user - System user entity
   * @param tokens - Token cost of the request
   * @returns Quota check result
   *
   * @see PRD V2 Section 2.4 - System User Quota Protection
   */
  private async checkSystemUserQuota(
    user: User,
    tokens: number
  ): Promise<QuotaCheckResult> {
    // Check if quota is exhausted
    const remaining = user.quota_daily - user.quota_used;
    if (remaining <= 0) {
      console.warn(
        `[Quota] System user quota exhausted: ${user.quota_used}/${user.quota_daily}`
      );
      return {
        allowed: false,
        remaining: 0,
      };
    }

    // Warn if approaching quota limit
    const usageRatio = user.quota_used / user.quota_daily;
    if (usageRatio >= 0.8) {
      console.warn(
        `[Quota] System user quota at ${Math.floor(usageRatio * 100)}%: ${user.quota_used}/${user.quota_daily}`
      );
    }

    // Check if single request exceeds limit (abnormal detection)
    if (tokens > 100) {
      console.warn(
        `[Quota] Abnormally large health check request: ${tokens} tokens`
      );
      return {
        allowed: false,
        remaining,
      };
    }

    return {
      allowed: true,
      remaining,
    };
  }

  /**
   * Deducts quota after a successful request (Phase 1 simplified).
   *
   * **Phase 1 Logic:**
   * - Only deducts for system user
   * - All other users skip deduction (no quota tracking in Phase 1)
   *
   * **Phase 2 (Future):**
   * - Will deduct from all levels: API Key → User → Department → Company
   *
   * @param userId - User ID
   * @param tokens - Tokens to deduct
   * @returns Deduction result
   */
  async deductQuota(
    userId: string,
    tokens: number
  ): Promise<QuotaDeductionResult> {
    // Phase 1: Only deduct for system user
    if (userId === SYSTEM_USER_ID) {
      const user = await queries.deductUserQuota(this.db, userId, tokens);
      return {
        tokens,
        quotaUsed: user.quota_used,
      };
    }

    // Phase 1: Skip deduction for all other users
    // TODO: Phase 2 - Implement full multi-level quota deduction
    return {
      tokens,
      quotaUsed: 0,
    };
  }
}
