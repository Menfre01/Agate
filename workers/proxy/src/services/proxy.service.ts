/**
 * Proxy Service for forwarding requests to AI providers.
 *
 * Orchestrates the complete proxy flow:
 * 1. Validate authentication
 * 2. Check quota
 * 3. Select provider credential
 * 4. Forward request
 * 5. Deduct quota
 * 6. Record usage
 *
 * @module services/proxy
 */

import type {
  AuthContext,
  ProxyMessageRequest,
  AnthropicUsage,
  Env,
} from "@agate/shared/types";
import { QuotaService } from "./quota.service.js";
import { ProviderService } from "./provider.service.js";
import { ModelService } from "./model.service.js";
import { UsageService } from "./usage.service.js";
import * as queries from "@agate/shared/db/queries.js";
import { QuotaExceededError, ValidationError } from "@agate/shared/utils/errors/index.js";

/**
 * Proxy result containing response and metadata.
 */
export interface ProxyResult {
  /** Response from upstream API */
  response: Response;
  /** Token usage from upstream */
  usage: AnthropicUsage;
  /** Request ID for tracing */
  requestId: string;
  /** Response time in milliseconds */
  responseTimeMs: number;
}

/**
 * Streaming proxy result.
 */
export interface StreamingProxyResult extends ProxyResult {
  /** Whether this is a streaming response */
  streaming: true;
  /** Readable stream of SSE events */
  stream: ReadableStream;
}

/**
 * Non-streaming proxy result.
 */
export interface NonStreamingProxyResult extends ProxyResult {
  /** Whether this is a streaming response */
  streaming: false;
}

/**
 * Proxy Service class.
 *
 * @example
 * ```ts
 * const proxy = new ProxyService(env);
 *
 * // Handle Anthropic Messages API request
 * const result = await proxy.forwardMessage(authContext, {
 *   model: "claude-3-sonnet",
 *   messages: [{ role: "user", content: "Hello" }],
 *   max_tokens: 100,
 * });
 *
 * return result.response;
 * ```
 */
export class ProxyService {
  private readonly quotaService: QuotaService;
  private readonly providerService: ProviderService;
  private readonly modelService: ModelService;
  private readonly usageService: UsageService;
  private readonly db: D1Database;

  /**
   * Creates a new ProxyService instance.
   *
   * @param env - Cloudflare Workers environment
   */
  constructor(env: Env) {
    this.db = env.DB;
    this.quotaService = new QuotaService(env);
    this.providerService = new ProviderService(env);
    this.modelService = new ModelService(env);
    this.usageService = new UsageService(env);
  }

  /**
   * Forwards a request to the Anthropic Messages API.
   *
   * @param authContext - Authentication context
   * @param request - Message request data
   * @returns Proxy result
   * @throws {QuotaExceededError} If quota exceeded
   * @throws {ValidationError} If model not allowed
   */
  async forwardMessage(
    authContext: AuthContext,
    request: ProxyMessageRequest
  ): Promise<NonStreamingProxyResult | StreamingProxyResult> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Validate model access
    const model = await this.modelService.getByModelId(request.model);
    if (!model || !model.is_active) {
      throw new ValidationError("Invalid or inactive model", {
        model: request.model,
      });
    }

    // Check department-level model access
    const allowed = await this.modelService.isModelAllowed(
      authContext.departmentId,
      model.id
    );
    if (!allowed) {
      throw new ValidationError("Model not allowed for your department", {
        model: request.model,
      });
    }

    // Fetch entities for quota check
    const [apiKey, user, department, company] = await Promise.all([
      queries.getApiKey(this.db, authContext.apiKeyId),
      queries.getUser(this.db, authContext.userId),
      authContext.departmentId
        ? queries.getDepartment(this.db, authContext.departmentId)
        : Promise.resolve(null),
      queries.getCompany(this.db, authContext.companyId),
    ]);

    if (!apiKey || !user || !company) {
      throw new Error("Failed to fetch entities for quota check");
    }

    // Estimate token cost for quota check (use max_tokens as upper bound)
    const estimatedTokens = this.estimateTokens(request);

    // Check quota
    const quotaCheck = await this.quotaService.checkQuota(
      apiKey,
      user,
      department,
      company,
      estimatedTokens
    );

    if (!quotaCheck.allowed) {
      throw new QuotaExceededError({
        quota: estimatedTokens,
        used: 0,
        entity: quotaCheck.failedAt ?? "quota",
      });
    }

    // Select provider credential
    const credential = await this.providerService.selectCredential(
      model.id,
      apiKey.id
    );

    // Build upstream request
    const upstreamRequest = this.buildUpstreamRequest(
      request,
      credential,
      requestId,
      model
    );

    // Execute request
    const result = await this.executeRequest(
      upstreamRequest,
      credential.baseUrl,
      requestId,
      startTime
    );

    // Process response and extract usage
    const usage = await this.extractUsage(result.response);

    // Deduct quota
    const actualTokens = usage.input_tokens + usage.output_tokens;
    await this.quotaService.deductQuota(
      apiKey.id,
      user.id,
      department?.id ?? null,
      company.id,
      actualTokens
    );

    // Record usage
    await this.usageService.recordUsage({
      apiKeyId: apiKey.id,
      userId: user.id,
      companyId: company.id,
      departmentId: department?.id ?? null,
      providerId: credential.providerId,
      modelId: model.id,
      modelName: model.model_id,
      endpoint: "/v1/messages",
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      status: "success",
      requestId,
      responseTimeMs: result.responseTimeMs,
    });

    // Update last_used_at
    await this.usageService.updateLastUsed(apiKey.id);

    return result;
  }

  /**
   * Executes the upstream request and handles streaming.
   *
   * @param request - Upstream request
   * @param baseUrl - Provider base URL
   * @param requestId - Request ID for tracing
   * @param startTime - Request start timestamp
   * @returns Proxy result
   */
  private async executeRequest(
    request: RequestInit,
    baseUrl: string,
    requestId: string,
    startTime: number
  ): Promise<NonStreamingProxyResult | StreamingProxyResult> {
    const url = `${baseUrl}/v1/messages`;
    const response = await fetch(url, request);
    const responseTimeMs = Date.now() - startTime;

    // Check if streaming
    const isStreaming = this.isStreamingResponse(response);

    if (isStreaming) {
      return {
        response,
        usage: { input_tokens: 0, output_tokens: 0 }, // Updated via stream
        requestId,
        responseTimeMs,
        streaming: true,
        stream: response.body!,
      };
    }

    // For non-streaming, extract usage from response
    const usage = await this.extractUsage(response);

    return {
      response,
      usage,
      requestId,
      responseTimeMs,
      streaming: false,
    };
  }

  /**
   * Builds the upstream request for Anthropic API.
   *
   * @param request - Original request data
   * @param credential - Selected provider credential
   * @param requestId - Request ID for tracing
   * @param model - Model entity with optional alias
   * @returns Fetch request init
   */
  private buildUpstreamRequest(
    request: ProxyMessageRequest,
    credential: {
      apiKey: string;
      apiVersion: string | null;
    },
    requestId: string,
    model: { alias: string | null }
  ): RequestInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "x-api-key": credential.apiKey,
      "anthropic-version": credential.apiVersion ?? "2023-06-01",
      "x-request-id": requestId,
    };

    // Use alias as upstream model name, fallback to original model_id
    const upstreamModel = model.alias ?? request.model;

    // Build request body
    const body = JSON.stringify({
      model: upstreamModel,
      messages: request.messages,
      max_tokens: request.max_tokens,
      ...(request.system && { system: request.system }),
      ...(request.stop_sequences && { stop_sequences: request.stop_sequences }),
      ...(request.temperature !== undefined && {
        temperature: request.temperature,
      }),
      ...(request.top_k !== undefined && { top_k: request.top_k }),
      ...(request.top_p !== undefined && { top_p: request.top_p }),
      stream: request.stream ?? false,
    });

    return {
      method: "POST",
      headers,
      body,
    };
  }

  /**
   * Extracts token usage from response.
   *
   * @param response - Upstream response
   * @returns Token usage
   */
  private async extractUsage(response: Response): Promise<AnthropicUsage> {
    if (!response.body) {
      return { input_tokens: 0, output_tokens: 0 };
    }

    try {
      const data = await response.json() as { usage?: AnthropicUsage };
      return data.usage ?? { input_tokens: 0, output_tokens: 0 };
    } catch {
      // Failed to parse - assume zero usage
      return { input_tokens: 0, output_tokens: 0 };
    }
  }

  /**
   * Checks if response is a streaming response.
   *
   * @param response - Upstream response
   * @returns true if streaming
   */
  private isStreamingResponse(response: Response): boolean {
    return (
      response.headers.get("content-type")?.includes("text/event-stream") ??
      false
    );
  }

  /**
   * Estimates token cost for quota pre-check.
   *
   * Uses a simple heuristic: max_tokens + estimated input tokens.
   *
   * @param request - Request data
   * @returns Estimated token count
   */
  private estimateTokens(request: ProxyMessageRequest): number {
    // Estimate input tokens (roughly 1 token per 4 characters)
    let estimatedInput = 0;
    for (const message of request.messages) {
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);
      estimatedInput += Math.ceil(content.length / 4);
    }

    if (request.system) {
      estimatedInput += Math.ceil(request.system.length / 4);
    }

    // Use max_tokens as output estimate
    const estimatedOutput = request.max_tokens;

    return estimatedInput + estimatedOutput;
  }

  /**
   * Records an error for usage tracking.
   *
   * @param authContext - Authentication context
   * @param modelId - Model ID
   * @param modelName - Model name
   * @param providerId - Provider ID
   * @param errorCode - Error code
   * @param responseTimeMs - Response time
   */
  async recordError(
    authContext: AuthContext,
    modelId: string,
    modelName: string,
    providerId: string,
    errorCode: string,
    responseTimeMs: number
  ): Promise<void> {
    const requestId = crypto.randomUUID();

    await this.usageService.recordUsage({
      apiKeyId: authContext.apiKeyId,
      userId: authContext.userId,
      companyId: authContext.companyId,
      departmentId: authContext.departmentId,
      providerId,
      modelId,
      modelName,
      endpoint: "/v1/messages",
      inputTokens: 0,
      outputTokens: 0,
      status: "error",
      errorCode,
      requestId,
      responseTimeMs,
    });
  }
}
