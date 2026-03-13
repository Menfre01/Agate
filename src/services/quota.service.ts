/**
 * Quota Service for quota checking and deduction.
 *
 * Implements multi-level quota validation:
 * API Key → User → Department → Company
 *
 * Supports both daily quota (auto-reset) and pool quota (manual refill).
 *
 * @module services/quota
 */

import type {
  ApiKey,
  User,
  Company,
  Department,
  QuotaChange,
  Env,
} from "@/types/index.js";
import * as queries from "@/db/queries.js";
import { generateId } from "@/utils/id-generator.js";
import { QuotaExceededError } from "@/utils/errors/index.js";

/**
 * Quota check result.
 */
export interface QuotaCheckResult {
  /** Whether quota check passed */
  allowed: boolean;
  /** Remaining quota at each level */
  remaining: {
    /** API Key daily quota remaining */
    apiKeyDaily: number;
    /** User daily quota remaining */
    userDaily: number;
    /** Department daily quota remaining */
    departmentDaily: number | null;
    /** Department pool quota remaining */
    departmentPool: number | null;
    /** Company daily quota remaining */
    companyDaily: number;
    /** Company pool quota remaining */
    companyPool: number;
  };
  /** Which level failed the check */
  failedAt?: "apiKey" | "user" | "department" | "company";
}

/**
 * Quota deduction result.
 */
export interface QuotaDeductionResult {
  /** Tokens deducted */
  tokens: number;
  /** Updated quota values */
  updated: {
    apiKey: { quota_used: number };
    user: { quota_used: number };
    department?: { daily_used: number; quota_used: number };
    company: { daily_used: number; quota_used: number };
  };
}

/**
 * UTC 0:00 timestamp for the current day.
 */
function getTodayUtcZero(): number {
  const now = new Date();
  const utc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0
  );
  return utc;
}

/**
 * Checks if a quota reset is needed and performs it.
 *
 * @param lastReset - Last reset timestamp
 * @param currentUsed - Current used value
 * @returns Whether reset was performed
 */
async function checkAndResetQuota(
  db: D1Database,
  entityType: "api_key" | "user" | "department" | "company",
  entityId: string,
  lastReset: number | null
): Promise<boolean> {
  const todayUtc = getTodayUtcZero();

  if (lastReset && lastReset >= todayUtc) {
    return false; // Already reset today
  }

  // Perform reset
  switch (entityType) {
    case "api_key":
      await queries.resetApiKeyQuota(db, entityId);
      break;
    case "user":
      await queries.resetUserQuota(db, entityId);
      break;
    case "department":
      await queries.resetDepartmentQuota(db, entityId);
      break;
    case "company":
      await queries.resetCompanyQuota(db, entityId);
      break;
  }

  return true;
}

/**
 * Quota Service class.
 *
 * @example
 * ```ts
 * const quota = new QuotaService(env);
 *
 * // Check quota before request
 * const check = await quota.checkQuota(authContext, 1000);
 * if (!check.allowed) {
 *   throw new QuotaExceededError(check);
 * }
 *
 * // Deduct after successful request
 * await quota.deductQuota(authContext, 1000);
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
   * Checks if a request is within quota limits.
   *
   * Checks quota levels in order (fine to coarse):
   * API Key → User → Department → Company
   *
   * @param apiKey - API Key entity
   * @param user - User entity
   * @param department - Department entity (optional)
   * @param company - Company entity
   * @param tokens - Token cost of the request
   * @returns Quota check result
   */
  async checkQuota(
    apiKey: ApiKey,
    user: User,
    department: Department | null,
    company: Company,
    tokens: number
  ): Promise<QuotaCheckResult> {
    // Skip check for unlimited keys
    if (apiKey.is_unlimited) {
      return {
        allowed: true,
        remaining: {
          apiKeyDaily: Infinity,
          userDaily: Infinity,
          departmentDaily: Infinity,
          departmentPool: Infinity,
          companyDaily: Infinity,
          companyPool: Infinity,
        },
      };
    }

    // Check and reset daily quotas if needed
    await this.ensureDailyQuotasReset(apiKey, user, department, company);

    // Fetch fresh data after potential resets
    const [freshKey, freshUser, freshDept, freshCompany] = await Promise.all([
      queries.getApiKey(this.db, apiKey.id),
      queries.getUser(this.db, user.id),
      department?.id
        ? queries.getDepartment(this.db, department.id)
        : Promise.resolve(null),
      queries.getCompany(this.db, company.id),
    ]);

    if (!freshKey || !freshUser || !freshCompany) {
      throw new Error("Failed to fetch fresh quota data");
    }

    // Calculate available quota including bonus
    const apiKeyAvailable = this.calculateApiKeyAvailable(freshKey);
    const userAvailable = freshUser.quota_daily - freshUser.quota_used;

    // Check API Key quota
    if (apiKeyAvailable < tokens) {
      return {
        allowed: false,
        remaining: {
          apiKeyDaily: apiKeyAvailable,
          userDaily: userAvailable,
          departmentDaily: freshDept
            ? freshDept.quota_daily - freshDept.daily_used
            : null,
          departmentPool: freshDept
            ? freshDept.quota_pool - freshDept.quota_used
            : null,
          companyDaily: freshCompany.quota_daily - freshCompany.daily_used,
          companyPool: freshCompany.quota_pool - freshCompany.quota_used,
        },
        failedAt: "apiKey",
      };
    }

    // Check User quota
    if (userAvailable < tokens) {
      return {
        allowed: false,
        remaining: {
          apiKeyDaily: apiKeyAvailable,
          userDaily: userAvailable,
          departmentDaily: freshDept
            ? freshDept.quota_daily - freshDept.daily_used
            : null,
          departmentPool: freshDept
            ? freshDept.quota_pool - freshDept.quota_used
            : null,
          companyDaily: freshCompany.quota_daily - freshCompany.daily_used,
          companyPool: freshCompany.quota_pool - freshCompany.quota_used,
        },
        failedAt: "user",
      };
    }

    // Check Department quota (if applicable)
    if (freshDept) {
      const deptDailyAvailable = freshDept.quota_daily - freshDept.daily_used;
      const deptPoolAvailable = freshDept.quota_pool - freshDept.quota_used;

      if (deptDailyAvailable < tokens && deptPoolAvailable < tokens) {
        return {
          allowed: false,
          remaining: {
            apiKeyDaily: apiKeyAvailable,
            userDaily: userAvailable,
            departmentDaily: deptDailyAvailable,
            departmentPool: deptPoolAvailable,
            companyDaily: freshCompany.quota_daily - freshCompany.daily_used,
            companyPool: freshCompany.quota_pool - freshCompany.quota_used,
          },
          failedAt: "department",
        };
      }
    }

    // Check Company quota
    const companyDailyAvailable = freshCompany.quota_daily - freshCompany.daily_used;
    const companyPoolAvailable = freshCompany.quota_pool - freshCompany.quota_used;

    if (companyDailyAvailable < tokens && companyPoolAvailable < tokens) {
      return {
        allowed: false,
        remaining: {
          apiKeyDaily: apiKeyAvailable,
          userDaily: userAvailable,
          departmentDaily: freshDept
            ? freshDept.quota_daily - freshDept.daily_used
            : null,
          departmentPool: freshDept
            ? freshDept.quota_pool - freshDept.quota_used
            : null,
          companyDaily: companyDailyAvailable,
          companyPool: companyPoolAvailable,
        },
        failedAt: "company",
      };
    }

    // All checks passed
    return {
      allowed: true,
      remaining: {
        apiKeyDaily: apiKeyAvailable,
        userDaily: userAvailable,
        departmentDaily: freshDept
          ? freshDept.quota_daily - freshDept.daily_used
          : null,
        departmentPool: freshDept
          ? freshDept.quota_pool - freshDept.quota_used
          : null,
        companyDaily: companyDailyAvailable,
        companyPool: companyPoolAvailable,
      },
    };
  }

  /**
   * Deducts quota after a successful request.
   *
   * Deducts from all applicable levels:
   * API Key → User → Department → Company
   *
   * Priority: Daily quota is used first, then pool quota.
   *
   * @param apiKeyId - API Key ID
   * @param userId - User ID
   * @param departmentId - Department ID (optional)
   * @param companyId - Company ID
   * @param tokens - Tokens to deduct
   * @returns Deduction result
   */
  async deductQuota(
    apiKeyId: string,
    userId: string,
    departmentId: string | null,
    companyId: string,
    tokens: number
  ): Promise<QuotaDeductionResult> {
    const now = Date.now();

    // Deduct from API Key
    const apiKey = await queries.deductApiKeyQuota(this.db, apiKeyId, tokens);

    // Deduct from User
    const user = await queries.deductUserQuota(this.db, userId, tokens);

    // Deduct from Department (if applicable)
    let department: Department | null = null;
    if (departmentId) {
      department = await this.deductDepartmentQuota(departmentId, tokens);
    }

    // Deduct from Company
    const company = await this.deductCompanyQuota(companyId, tokens);

    return {
      tokens,
      updated: {
        apiKey: { quota_used: apiKey.quota_used },
        user: { quota_used: user.quota_used },
        ...(department && {
          department: {
            daily_used: department.daily_used,
            quota_used: department.quota_used,
          },
        }),
        company: {
          daily_used: company.daily_used,
          quota_used: company.quota_used,
        },
      },
    };
  }

  /**
   * Records a quota change for audit purposes.
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param changeType - Change type
   * @param changeAmount - Amount changed
   * @param previousQuota - Previous quota value
   * @param newQuota - New quota value
   * @param reason - Reason for change (optional)
   * @param createdBy - User who made the change (optional)
   */
  async recordQuotaChange(
    entityType: "api_key" | "department" | "company",
    entityId: string,
    changeType: "set" | "add" | "reset" | "bonus",
    changeAmount: number,
    previousQuota: number,
    newQuota: number,
    reason?: string,
    createdBy?: string
  ): Promise<void> {
    const change: QuotaChange = {
      id: generateId(),
      entity_type: entityType,
      entity_id: entityId,
      change_type: changeType,
      change_amount: changeAmount,
      previous_quota: previousQuota,
      new_quota: newQuota,
      reason: reason ?? null,
      created_by: createdBy ?? null,
      created_at: Date.now(),
    };

    await queries.createQuotaChange(this.db, change);
  }

  /**
   * Ensures daily quotas are reset if needed.
   *
   * @param apiKey - API Key entity
   * @param user - User entity
   * @param department - Department entity (optional)
   * @param company - Company entity
   */
  private async ensureDailyQuotasReset(
    apiKey: ApiKey,
    user: User,
    department: Department | null,
    company: Company
  ): Promise<void> {
    const todayUtc = getTodayUtcZero();

    const resets = [
      checkAndResetQuota(this.db, "api_key", apiKey.id, apiKey.last_reset_at),
      checkAndResetQuota(this.db, "user", user.id, user.last_reset_at),
      checkAndResetQuota(this.db, "company", company.id, company.last_reset_at),
    ];

    if (department) {
      resets.push(
        checkAndResetQuota(
          this.db,
          "department",
          department.id,
          department.last_reset_at
        )
      );
    }

    await Promise.all(resets);
  }

  /**
   * Calculates available quota for an API Key including bonus.
   *
   * @param apiKey - API Key entity
   * @returns Available quota
   */
  private calculateApiKeyAvailable(apiKey: ApiKey): number {
    const dailyRemaining = apiKey.quota_daily - apiKey.quota_used;
    let bonusRemaining = 0;

    // Check if bonus is still valid
    if (apiKey.quota_bonus > 0) {
      if (!apiKey.quota_bonus_expiry || apiKey.quota_bonus_expiry > Date.now()) {
        bonusRemaining = apiKey.quota_bonus;
      }
    }

    return dailyRemaining + bonusRemaining;
  }

  /**
   * Deducts quota from department.
   *
   * Priority: Daily quota first, then pool quota.
   *
   * @param departmentId - Department ID
   * @param tokens - Tokens to deduct
   * @returns Updated department
   */
  private async deductDepartmentQuota(
    departmentId: string,
    tokens: number
  ): Promise<Department> {
    const dept = await queries.getDepartment(this.db, departmentId);
    if (!dept) {
      throw new Error(`Department not found: ${departmentId}`);
    }

    const dailyAvailable = dept.quota_daily - dept.daily_used;

    if (dailyAvailable >= tokens) {
      // Use daily quota
      return queries.deductDepartmentDailyQuota(this.db, departmentId, tokens);
    } else {
      // Use remaining daily + pool quota
      const remainingDaily = dailyAvailable;
      const fromPool = tokens - remainingDaily;
      return queries.deductDepartmentMixedQuota(
        this.db,
        departmentId,
        remainingDaily,
        fromPool
      );
    }
  }

  /**
   * Deducts quota from company.
   *
   * Priority: Daily quota first, then pool quota.
   *
   * @param companyId - Company ID
   * @param tokens - Tokens to deduct
   * @returns Updated company
   */
  private async deductCompanyQuota(
    companyId: string,
    tokens: number
  ): Promise<Company> {
    const company = await queries.getCompany(this.db, companyId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    const dailyAvailable = company.quota_daily - company.daily_used;

    if (dailyAvailable >= tokens) {
      // Use daily quota
      return queries.deductCompanyDailyQuota(this.db, companyId, tokens);
    } else {
      // Use remaining daily + pool quota
      const remainingDaily = dailyAvailable;
      const fromPool = tokens - remainingDaily;
      return queries.deductCompanyMixedQuota(
        this.db,
        companyId,
        remainingDaily,
        fromPool
      );
    }
  }
}
