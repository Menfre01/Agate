/**
 * Usage Service for tracking and reporting API usage.
 *
 * Records usage logs and provides aggregation for statistics.
 *
 * @module services/usage
 */

import type {
  UsageLog,
  UsageLogsQuery,
  UsageLogsResponse,
  UsageStatsQuery,
  UsageStatsResponse,
  TokenUsageSummaryResponse,
  CostAnalysisResponse,
  ModelStatsResponse,
  Env,
} from "@/types/index.js";
import * as queries from "@/db/queries.js";
import { generateId } from "@/utils/id-generator.js";

/**
 * Usage log creation parameters.
 */
export interface CreateUsageLogParams {
  /** API Key ID */
  apiKeyId: string;
  /** User ID */
  userId: string;
  /** Company ID */
  companyId: string;
  /** Department ID (optional) */
  departmentId: string | null;
  /** Provider ID */
  providerId: string;
  /** Model ID */
  modelId: string;
  /** Model name (for query convenience) */
  modelName: string;
  /** API endpoint called */
  endpoint: string;
  /** Input token count */
  inputTokens: number;
  /** Output token count */
  outputTokens: number;
  /** Request status */
  status: "success" | "error";
  /** Error code (if status is 'error') */
  errorCode?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Response time in milliseconds */
  responseTimeMs?: number;
}

/**
 * Usage Service class.
 *
 * @example
 * ```ts
 * const usage = new UsageService(env);
 *
 * // Record usage
 * await usage.recordUsage({
 *   apiKeyId: "key-123",
 *   userId: "user-123",
 *   companyId: "company-123",
 *   providerId: "provider-123",
 *   modelId: "model-123",
 *   modelName: "claude-3-sonnet",
 *   endpoint: "/v1/messages",
 *   inputTokens: 100,
 *   outputTokens: 50,
 *   status: "success",
 * });
 *
 * // Query usage logs
 * const logs = await usage.queryLogs({ limit: 50 });
 * ```
 */
export class UsageService {
  private readonly db: D1Database;

  /**
   * Creates a new UsageService instance.
   *
   * @param env - Cloudflare Workers environment
   */
  constructor(env: Env) {
    this.db = env.DB;
  }

  /**
   * Records a usage log.
   *
   * @param params - Usage log parameters
   * @returns Created usage log ID
   */
  async recordUsage(params: CreateUsageLogParams): Promise<string> {
    const log: UsageLog = {
      id: generateId(),
      api_key_id: params.apiKeyId,
      user_id: params.userId,
      company_id: params.companyId,
      department_id: params.departmentId,
      provider_id: params.providerId,
      model_id: params.modelId,
      model_name: params.modelName,
      endpoint: params.endpoint,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: params.inputTokens + params.outputTokens,
      status: params.status,
      error_code: params.errorCode ?? null,
      request_id: params.requestId ?? null,
      response_time_ms: params.responseTimeMs ?? null,
      created_at: Date.now(),
    };

    await queries.createUsageLog(this.db, log);

    return log.id;
  }

  /**
   * Queries usage logs with filtering and pagination.
   *
   * @param query - Query parameters
   * @returns Paginated usage logs response
   */
  async queryLogs(query: UsageLogsQuery): Promise<UsageLogsResponse> {
    const pageSize = query.page_size ?? 50;
    const page = query.page ?? 1;
    const offset = (page - 1) * pageSize;

    const { logs, total } = await queries.queryUsageLogs(this.db, {
      start_at: query.start_at,
      end_at: query.end_at,
      user_id: query.user_id,
      company_id: query.company_id,
      department_id: query.department_id,
      model_id: query.model_id,
      api_key_id: query.api_key_id,
      status: query.status,
      limit: pageSize,
      offset,
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      logs: logs.map((log) => ({
        id: log.id,
        api_key_id: log.api_key_id,
        user_email: "", // Populated via JOIN
        company_name: "", // Populated via JOIN
        department_name: null,
        provider_name: "", // Populated via JOIN
        model_name: log.model_name,
        endpoint: log.endpoint,
        input_tokens: log.input_tokens,
        output_tokens: log.output_tokens,
        total_tokens: log.total_tokens,
        status: log.status,
        error_code: log.error_code,
        request_id: log.request_id,
        response_time_ms: log.response_time_ms,
        created_at: log.created_at,
      })),
    };
  }

  /**
   * Gets usage statistics for a time period.
   *
   * @param query - Statistics query parameters
   * @returns Usage statistics response
   */
  async getUsageStats(query: UsageStatsQuery): Promise<UsageStatsResponse> {
    const stats = await queries.getUsageStats(this.db, {
      start_at: query.start_at,
      end_at: query.end_at,
      company_id: query.company_id,
      department_id: query.department_id,
      user_id: query.user_id,
      model_id: query.model_id,
    });

    const grouped: Array<{ key: string; requests: number; tokens: number; cost: number }> = [];

    if (query.group_by) {
      const groupedStats = await queries.getUsageStatsGrouped(this.db, {
        ...query,
        group_by: query.group_by,
      });

      for (const row of groupedStats) {
        grouped.push({
          key: row.group_key,
          requests: row.request_count,
          tokens: row.total_tokens,
          cost: row.estimated_cost,
        });
      }
    }

    return {
      total_requests: stats.total_requests ?? 0,
      successful_requests: stats.successful_requests ?? 0,
      failed_requests: stats.failed_requests ?? 0,
      input_tokens: stats.input_tokens ?? 0,
      total_output_tokens: stats.output_tokens ?? 0,
      total_tokens: stats.total_tokens ?? 0,
      estimated_cost: stats.estimated_cost ?? 0,
      grouped,
    };
  }

  /**
   * Gets token usage summary.
   *
   * @param query - Query parameters
   * @returns Token usage summary response
   */
  async getTokenUsage(
    query: Pick<UsageStatsQuery, "start_at" | "end_at" | "company_id" | "department_id" | "user_id">
  ): Promise<TokenUsageSummaryResponse> {
    const summary = await queries.getTokenUsageSummary(this.db, {
      start_at: query.start_at,
      end_at: query.end_at,
      company_id: query.company_id,
      department_id: query.department_id,
      user_id: query.user_id,
    });

    const byModel = await queries.getTokenUsageByModel(this.db, {
      start_at: query.start_at,
      end_at: query.end_at,
      company_id: query.company_id,
      department_id: query.department_id,
      user_id: query.user_id,
    });

    return {
      total_tokens: summary.total_tokens ?? 0,
      input_tokens: summary.input_tokens ?? 0,
      output_tokens: summary.output_tokens ?? 0,
      by_model: byModel.map((m) => ({
        model_id: m.model_id,
        model_name: m.model_name,
        input_tokens: m.input_tokens,
        output_tokens: m.output_tokens,
        total_tokens: m.total_tokens,
        requests: m.request_count,
      })),
    };
  }

  /**
   * Gets cost analysis by model and provider.
   *
   * @param query - Query parameters
   * @returns Cost analysis response
   */
  async getCostAnalysis(
    query: Pick<UsageStatsQuery, "start_at" | "end_at" | "company_id">
  ): Promise<CostAnalysisResponse> {
    const totalCost = await queries.getTotalCost(this.db, {
      start_at: query.start_at,
      end_at: query.end_at,
      company_id: query.company_id,
    });

    const byModel = await queries.getCostByModel(this.db, {
      start_at: query.start_at,
      end_at: query.end_at,
      company_id: query.company_id,
    });

    const byProvider = await queries.getCostByProvider(this.db, {
      start_at: query.start_at,
      end_at: query.end_at,
      company_id: query.company_id,
    });

    return {
      total_cost: totalCost.total_cost ?? 0,
      by_model: byModel.map((m) => ({
        model_id: m.model_id,
        model_name: m.model_name,
        input_cost: m.input_cost ?? 0,
        output_cost: m.output_cost ?? 0,
        total_cost: m.total_cost ?? 0,
      })),
      by_provider: byProvider.map((p) => ({
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        total_cost: p.total_cost ?? 0,
      })),
    };
  }

  /**
   * Gets model usage statistics.
   *
   * @param query - Query parameters
   * @returns Model stats response
   */
  async getModelStats(
    query: Pick<UsageStatsQuery, "start_at" | "end_at" | "company_id">
  ): Promise<ModelStatsResponse[]> {
    const stats = await queries.getModelStats(this.db, {
      start_at: query.start_at,
      end_at: query.end_at,
      company_id: query.company_id,
    });

    return stats.map((s) => ({
      model_id: s.model_id,
      model_name: s.model_name,
      request_count: s.request_count,
      total_tokens: s.total_tokens,
      avg_tokens_per_request: s.avg_tokens_per_request ?? 0,
      success_rate: s.success_rate ?? 0,
      avg_response_time_ms: s.avg_response_time_ms ?? 0,
    }));
  }

  /**
   * Updates the last_used_at timestamp for an API Key.
   *
   * @param apiKeyId - API Key ID
   */
  async updateLastUsed(apiKeyId: string): Promise<void> {
    await queries.updateApiKeyLastUsed(this.db, apiKeyId);
  }
}
