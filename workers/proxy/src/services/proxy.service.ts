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
  /** Context for recording usage after stream completes (added by forwardMessage) */
  usageContext?: {
    /** Auth context */
    authContext: import("@agate/shared/types").AuthContext;
    /** API Key ID */
    apiKeyId: string;
    /** User ID */
    userId: string;
    /** Department ID */
    departmentId: string | null;
    /** Provider ID */
    providerId: string;
    /** Model ID */
    modelId: string;
    /** Model name sent to upstream */
    modelName: string;
    /** Request start time */
    startTime: number;
  };
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
   * @param clientRequest - Original client request (for header forwarding)
   * @returns Proxy result
   * @throws {QuotaExceededError} If quota exceeded
   * @throws {ValidationError} If model not allowed
   */
  async forwardMessage(
    authContext: AuthContext,
    request: ProxyMessageRequest,
    clientRequest?: Request
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

    // Fetch entities needed for request processing
    const [apiKey, user] = await Promise.all([
      queries.getApiKey(this.db, authContext.apiKeyId),
      queries.getUser(this.db, authContext.userId),
    ]);

    if (!apiKey || !user) {
      throw new Error("Failed to fetch entities for request processing");
    }

    // Estimate token cost for quota check (use max_tokens as upper bound)
    const estimatedTokens = this.estimateTokens(request);

    // Check quota (Phase 1: only enforces for system user)
    const quotaCheck = await this.quotaService.checkQuota(
      user,
      estimatedTokens
    );

    if (!quotaCheck.allowed) {
      throw new QuotaExceededError({
        quota: estimatedTokens,
        used: 0,
        entity: "system_user",
      });
    }

    // Select provider credential
    const credential = await this.providerService.selectCredential(
      model.id,
      apiKey.id
    );

    // Build upstream request and get actual upstream model name
    // Priority: credential.actualModelId > model.alias > request.model
    const upstreamModel = credential.actualModelId ?? model.alias ?? request.model;
    const upstreamRequest = this.buildUpstreamRequest(
      request,
      credential,
      requestId,
      upstreamModel,
      clientRequest?.headers
    );

    // Execute request
    const result = await this.executeRequest(
      upstreamRequest,
      credential.baseUrl,
      requestId,
      startTime
    );

    // Process usage based on response type
    if (result.streaming) {
      // For streaming: include context for usage recording after stream completes
      return {
        ...result,
        usageContext: {
          authContext,
          apiKeyId: apiKey.id,
          userId: user.id,
          departmentId: authContext.departmentId,
          providerId: credential.providerId,
          modelId: model.id,
          modelName: upstreamModel,
          startTime,
        },
      };
    }

    // For non-streaming: extract usage from response body
    const usage = await this.extractUsage(result.response);

    // Deduct quota (Phase 1: only for system user)
    const actualTokens = usage.input_tokens + usage.output_tokens;
    await this.quotaService.deductQuota(user.id, actualTokens);

    // Record usage - use actual upstream model name for cost calculation
    await this.usageService.recordUsage({
      apiKeyId: apiKey.id,
      userId: user.id,
      companyId: null,  // PRD V2 Phase 1: no company
      departmentId: authContext.departmentId,
      providerId: credential.providerId,
      modelId: model.id,
      modelName: upstreamModel,  // 使用实际发送给上游的 model 名称
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
    // We need to read the JSON to get usage, but also recreate the response
    // so the body is available for the client
    const { usage, data } = await this.extractUsageWithBody(response);

    // Recreate response with the original JSON body
    // Use JSON.stringify instead of Response.json to have better control over the body
    const bodyText = JSON.stringify(data);
    const headers = new Headers(response.headers);
    // Ensure content-type is set correctly
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const newResponse = new Response(bodyText, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    return {
      response: newResponse,
      usage,
      requestId,
      responseTimeMs,
      streaming: false,
    };
  }

  /**
   * Builds the upstream request for Anthropic API.
   *
   * Forwards all known parameters and passes through unknown parameters
   * to support Claude Code and beta features (tools, extended thinking, etc.).
   *
   * @param request - Original request data
   * @param credential - Selected provider credential
   * @param requestId - Request ID for tracing
   * @param upstreamModel - Actual model name to send to upstream
   * @param clientHeaders - Original client request headers (for beta header forwarding)
   * @returns Fetch request init
   */
  private buildUpstreamRequest(
    request: ProxyMessageRequest,
    credential: {
      apiKey: string;
      apiVersion: string | null;
    },
    requestId: string,
    upstreamModel: string,
    clientHeaders?: Headers
  ): RequestInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": credential.apiKey,
      "anthropic-version": credential.apiVersion ?? "2023-06-01",
      "x-request-id": requestId,
    };

    // Forward anthropic-beta headers from client if present
    // This enables beta features like tools, computer use, extended thinking
    if (clientHeaders) {
      const betaHeaders = clientHeaders.get("anthropic-beta");
      if (betaHeaders) {
        headers["anthropic-beta"] = betaHeaders;
      }
    }

    // Known parameters that we explicitly handle
    const knownParams = new Set([
      "model", "messages", "max_tokens", "system", "stop_sequences",
      "temperature", "top_k", "top_p", "stream", "tools", "tool_choice",
      "thinking", "metadata", "cache_control",
    ]);

    // Build request body with all parameters
    const body: Record<string, unknown> = {
      model: upstreamModel,
      messages: request.messages,
      max_tokens: request.max_tokens,
    };

    // Add optional known parameters if present
    if (request.system !== undefined) body.system = request.system;
    if (request.stop_sequences) body.stop_sequences = request.stop_sequences;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.top_k !== undefined) body.top_k = request.top_k;
    if (request.top_p !== undefined) body.top_p = request.top_p;
    if (request.tools) body.tools = request.tools;
    if (request.tool_choice) body.tool_choice = request.tool_choice;
    if (request.thinking) body.thinking = request.thinking;
    if (request.metadata) body.metadata = request.metadata;
    if (request.cache_control) body.cache_control = request.cache_control;
    body.stream = request.stream ?? false;

    // Pass through any unknown parameters (for Claude Code compatibility)
    for (const [key, value] of Object.entries(request)) {
      if (!knownParams.has(key) && value !== undefined) {
        body[key] = value;
      }
    }

    return {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    };
  }

  /**
   * Extracts usage information and body data from response.
   *
   * @param response - Response from upstream
   * @returns Usage information and original response body data
   */
  private async extractUsageWithBody(response: Response): Promise<{
    usage: AnthropicUsage;
    data: unknown;
  }> {
    if (!response.body) {
      return { usage: { input_tokens: 0, output_tokens: 0 }, data: null };
    }

    try {
      const data = await response.json() as { usage?: AnthropicUsage };
      const rawUsage = data.usage ?? { input_tokens: 0, output_tokens: 0 };

      // Validate and clamp token counts to non-negative values
      const inputTokens = Math.max(0, rawUsage.input_tokens);
      const outputTokens = Math.max(0, rawUsage.output_tokens);

      // Log warning if upstream returned negative tokens
      if (rawUsage.input_tokens < 0 || rawUsage.output_tokens < 0) {
        console.warn(
          `Upstream API returned negative token counts: ` +
          `input_tokens=${rawUsage.input_tokens}, output_tokens=${rawUsage.output_tokens}. Clamped to 0.`
        );
      }

      return {
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        data
      };
    } catch {
      // Failed to parse - assume zero usage and null data
      return { usage: { input_tokens: 0, output_tokens: 0 }, data: null };
    }
  }

  /**
   * Extracts token usage from response.
   *
   * Validates and clamps token counts to non-negative values.
   * Some third-party proxies may return negative values.
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
      const rawUsage = data.usage ?? { input_tokens: 0, output_tokens: 0 };

      // Validate and clamp token counts to non-negative values
      const inputTokens = Math.max(0, rawUsage.input_tokens);
      const outputTokens = Math.max(0, rawUsage.output_tokens);

      // Log warning if upstream returned negative tokens
      if (rawUsage.input_tokens < 0 || rawUsage.output_tokens < 0) {
        console.warn(
          `Upstream API returned negative token counts: ` +
          `input_tokens=${rawUsage.input_tokens}, output_tokens=${rawUsage.output_tokens}. Clamped to 0.`
        );
      }

      return { input_tokens: inputTokens, output_tokens: outputTokens };
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
