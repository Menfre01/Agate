/**
 * Health Check Service for provider credential monitoring.
 *
 * Periodically checks all active provider credentials using minimal API calls,
 * updates health status, and records usage to the system user account.
 *
 * @module services/health-check
 */

import type {
  Env,
  UsageLog,
} from "@agate/shared/types";
import * as queries from "@agate/shared/db/queries.js";
import { generateId } from "@agate/shared/utils/id-generator.js";

/**
 * Health check result for a single credential.
 */
export interface HealthCheckResult {
  /** Credential ID */
  credentialId: string;
  /** Provider ID */
  providerId: string;
  /** Credential name */
  credentialName: string;
  /** Whether the check was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens consumed */
  outputTokens: number;
}

/**
 * Summary of health check execution.
 */
export interface HealthCheckSummary {
  /** Total credentials checked */
  total: number;
  /** Successful checks */
  successful: number;
  /** Failed checks */
  failed: number;
  /** Skipped checks (e.g., quota exceeded) */
  skipped: number;
  /** Total tokens consumed */
  totalTokens: number;
  /** Individual results */
  results: HealthCheckResult[];
}

/**
 * Minimal health check request body.
 */
interface HealthCheckRequest {
  model: string;
  max_tokens: number;
  messages: Array<{ role: string; content: string }>;
}

/**
 * Anthropic API response.
 */
interface AnthropicResponse {
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Extended Env interface with health check specific variables.
 */
interface HealthCheckEnv extends Env {
  /** System user ID */
  SYSTEM_USER_ID?: string;
  /** System company ID */
  SYSTEM_COMPANY_ID?: string;
  /** Health check model override */
  HEALTH_CHECK_MODEL?: string;
  /** Health check max tokens override */
  HEALTH_CHECK_MAX_TOKENS?: number;
  /** Health check timeout override (ms) */
  HEALTH_CHECK_TIMEOUT?: number;
}

/**
 * Health Check Service class.
 *
 * @example
 * ```ts
 * const service = new HealthCheckService(env);
 * const summary = await service.runAllChecks();
 * console.log(`Checked ${summary.total} credentials, ${summary.successful} healthy`);
 * ```
 */
export class HealthCheckService {
  private readonly db: D1Database;
  private readonly encryptionKey: string;
  private readonly systemUserId: string;
  private readonly systemCompanyId: string;
  private readonly maxTokens: number;
  private readonly requestTimeout: number;

  /**
   * Health check constants.
   */
  private static readonly MAX_TOKENS = 1;
  private static readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private static readonly DAILY_QUOTA_WARNING_THRESHOLD = 0.8; // 80%

  /**
   * Creates a new HealthCheckService instance.
   *
   * @param env - Cloudflare Workers environment
   */
  constructor(env: HealthCheckEnv) {
    this.db = env.DB;
    this.encryptionKey = env.ENCRYPTION_KEY ?? "default-key";
    this.systemUserId = env.SYSTEM_USER_ID ?? "sys-health-user";
    this.systemCompanyId = env.SYSTEM_COMPANY_ID ?? "sys-health";
    this.maxTokens = env.HEALTH_CHECK_MAX_TOKENS ?? HealthCheckService.MAX_TOKENS;
    this.requestTimeout = env.HEALTH_CHECK_TIMEOUT ?? HealthCheckService.REQUEST_TIMEOUT;
  }

  /**
   * Runs health checks on all active credentials.
   *
   * @returns Summary of health check execution
   */
  async runAllChecks(): Promise<HealthCheckSummary> {
    const summary: HealthCheckSummary = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalTokens: 0,
      results: [],
    };

    // 1. Check system user quota
    const quotaCheck = await this.checkSystemUserQuota();
    if (!quotaCheck.canProceed) {
      console.warn(`Health check skipped: ${quotaCheck.reason}`);
      summary.skipped = 1;
      return summary;
    }

    // 2. Get all active credentials
    const credentials = await queries.getAllActiveCredentials(this.db);
    summary.total = credentials.length;

    if (credentials.length === 0) {
      console.log("No active credentials to check");
      return summary;
    }

    // 3. Get system API key ID
    const systemApiKey = await this.getSystemApiKey();
    if (!systemApiKey) {
      console.error("System API key not found, cannot proceed with health checks");
      summary.skipped = summary.total;
      return summary;
    }

    // 4. Check each credential
    for (const cred of credentials) {
      // Check quota before each check
      const currentQuota = await this.checkSystemUserQuota();
      if (!currentQuota.canProceed) {
        console.warn(`Health check interrupted: ${currentQuota.reason}`);
        summary.skipped = credentials.length - summary.results.length;
        break;
      }

      const result = await this.checkCredential(cred, systemApiKey);
      summary.results.push(result);

      if (result.success) {
        summary.successful++;
        summary.totalTokens += result.inputTokens + result.outputTokens;
      } else {
        summary.failed++;
      }

      // Update health status with consecutive_failures tracking (PRD V2 Section 2.4.5)
      if (result.success) {
        // Success: reset consecutive_failures and mark healthy
        await queries.recordCredentialSuccess(this.db, cred.id);
      } else {
        // Failure: increment consecutive_failures, auto-mark unhealthy if >= 3
        await queries.incrementCredentialFailure(this.db, cred.id);
      }
    }

    return summary;
  }

  /**
   * Checks a single credential.
   *
   * @param credential - Credential to check
   * @param systemApiKey - System API key ID for usage logging
   * @returns Health check result
   */
  async checkCredential(
    credential: {
      id: string;
      provider_id: string;
      credential_name: string;
      api_key_encrypted: string;
      base_url: string | null;
      provider_name: string;
      provider_base_url: string;
      /** Internal model ID for health check */
      health_check_model_id: string;
      /** Upstream model name for health check */
      health_check_model_name: string;
    },
    systemApiKey: string
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      credentialId: credential.id,
      providerId: credential.provider_id,
      credentialName: credential.credential_name,
      success: false,
      responseTimeMs: 0,
      inputTokens: 0,
      outputTokens: 0,
    };

    try {
      // Decrypt API key
      const apiKey = await this.decryptApiKey(credential.api_key_encrypted);

      // Resolve base URL: credential level takes precedence
      const baseUrl = credential.base_url ?? credential.provider_base_url;

      // Build minimal request - use provider's health check model
      const requestBody: HealthCheckRequest = {
        model: credential.health_check_model_name,
        max_tokens: this.maxTokens,
        messages: [{ role: "user", content: "." }],
      };

      // Make request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      result.responseTimeMs = Date.now() - startTime;
      result.statusCode = response.status;

      if (response.ok) {
        const data = (await response.json()) as AnthropicResponse;
        result.success = true;
        result.inputTokens = data.usage?.input_tokens ?? 0;
        result.outputTokens = data.usage?.output_tokens ?? 0;

        // Record usage log with actual model used
        await this.recordUsage(systemApiKey, {
          providerId: credential.provider_id,
          status: "success",
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          responseTimeMs: result.responseTimeMs,
          modelId: credential.health_check_model_id,
          modelName: credential.health_check_model_name,
        });
      } else {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
        await this.recordUsage(systemApiKey, {
          providerId: credential.provider_id,
          status: "error",
          inputTokens: 0,
          outputTokens: 0,
          responseTimeMs: result.responseTimeMs,
          errorCode: String(response.status),
          modelId: credential.health_check_model_id,
          modelName: credential.health_check_model_name,
        });
      }
    } catch (error) {
      result.responseTimeMs = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);

      await this.recordUsage(systemApiKey, {
        providerId: credential.provider_id,
        status: "error",
        inputTokens: 0,
        outputTokens: 0,
        responseTimeMs: result.responseTimeMs,
        errorCode: "NETWORK_ERROR",
        modelId: credential.health_check_model_id,
        modelName: credential.health_check_model_name,
      });
    }

    return result;
  }

  /**
   * Checks if system user has sufficient quota.
   *
   * @returns Quota check result
   */
  private async checkSystemUserQuota(): Promise<{
    canProceed: boolean;
    reason?: string;
    remaining?: number;
  }> {
    const quota = await queries.getSystemUserQuota(this.db);

    if (!quota) {
      return { canProceed: false, reason: "System user not found" };
    }

    // Check if quota is exhausted
    if (quota.quota_remaining <= 0) {
      return { canProceed: false, reason: "Daily quota exhausted", remaining: 0 };
    }

    // Warn if approaching quota limit
    const usageRatio = quota.quota_used / quota.quota_daily;
    if (usageRatio >= HealthCheckService.DAILY_QUOTA_WARNING_THRESHOLD) {
      return {
        canProceed: true,
        reason: `Quota usage at ${(usageRatio * 100).toFixed(0)}%`,
        remaining: quota.quota_remaining,
      };
    }

    return { canProceed: true, remaining: quota.quota_remaining };
  }

  /**
   * Gets the system API key ID.
   *
   * @returns System API key ID or null
   */
  private async getSystemApiKey(): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT id FROM api_keys WHERE user_id = ?1 LIMIT 1')
      .bind(this.systemUserId)
      .first<{ id: string }>();

    return result?.id ?? null;
  }

  /**
   * Records health check usage to usage_logs table.
   *
   * @param apiKeyId - System API key ID
   * @param params - Usage parameters
   */
  private async recordUsage(
    apiKeyId: string,
    params: {
      providerId: string;
      status: "success" | "error";
      inputTokens: number;
      outputTokens: number;
      responseTimeMs: number;
      errorCode?: string;
      modelName: string;
      modelId: string;
    }
  ): Promise<void> {
    const log: UsageLog = {
      id: generateId(),
      api_key_id: apiKeyId,
      user_id: this.systemUserId,
      company_id: this.systemCompanyId,
      department_id: null,
      provider_id: params.providerId,
      model_id: params.modelId,
      model_name: params.modelName,
      endpoint: "/v1/messages",
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: params.inputTokens + params.outputTokens,
      status: params.status,
      error_code: params.errorCode ?? null,
      request_id: null,
      response_time_ms: params.responseTimeMs,
      created_at: Date.now(),
    };

    await queries.createUsageLog(this.db, log);
  }

  /**
   * Decrypts an API key using the encryption secret.
   *
   * @param encrypted - Hex-encoded encrypted key
   * @returns Decrypted API key
   */
  private async decryptApiKey(encrypted: string): Promise<string> {
    const combined = Uint8Array.from(
      { length: encrypted.length / 2 },
      (_, i) => Number.parseInt(encrypted.slice(i * 2, i * 2 + 2), 16)
    );

    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.encryptionKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
    const keyBytes = new Uint8Array(hashBuffer);

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decrypted);
  }
}
