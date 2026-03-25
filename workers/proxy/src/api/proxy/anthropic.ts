/**
 * Anthropic Messages API Proxy
 *
 * Proxies requests to Anthropic's Messages API (/v1/messages)
 * with authentication, quota checking, and usage tracking.
 *
 * @module api/proxy/anthropic
 */

import type { Env, RequestContext, ProxyMessageRequest, AuthContext, AnthropicUsage } from "@agate/shared/types";
import { validateRequestAuth } from "@agate/proxy/middleware/auth.js";
import { ProxyService } from "@agate/proxy/services/proxy.service.js";
import { QuotaExceededError, ValidationError } from "@agate/shared/utils/errors";
import { logError, logResponse, withResponseLogging } from "@agate/shared/middleware/logger";
import { UsageService } from "@agate/proxy/services/usage.service.js";
import { QuotaService } from "@agate/proxy/services/quota.service.js";
import { getRateLimitHeaders } from "@agate/shared/middleware/ratelimit.js";

/**
 * Handles POST /v1/messages requests.
 *
 * Forwards requests to Anthropic API after:
 * 1. Validating API key
 * 2. Checking quota
 * 3. Selecting provider credential
 * 4. Recording usage
 *
 * @param request - Incoming request
 * @param env - Cloudflare Workers environment
 * @param context - Request context
 * @returns Response from upstream or error response
 */
export async function handleMessages(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  try {
    // Validate authentication
    const authContext = await validateRequestAuth(request, env);
    context.auth = authContext;

    // Parse request body
    const body = await request.json() as ProxyMessageRequest;

    // Validate required fields
    if (!body.model) {
      throw new ValidationError("Missing required field: model");
    }
    if (!body.messages || !Array.isArray(body.messages)) {
      throw new ValidationError("Missing or invalid field: messages");
    }
    if (typeof body.max_tokens !== "number") {
      throw new ValidationError("Missing or invalid field: max_tokens");
    }

    // Forward to upstream (pass original request for header forwarding)
    const proxyService = new ProxyService(env);
    const result = await proxyService.forwardMessage(authContext, body, request);

    // For streaming responses, we need to handle the stream
    if (result.streaming) {
      return handleStreamingResponse(result, context, env);
    }

    // For non-streaming, return the response directly
    return withResponseLogging(result.response, context);
  } catch (error) {
    return handleMessagesError(error, context, env);
  }
}

/**
 * Handles streaming response from upstream.
 *
 * Intercepts SSE events to extract usage information and records it
 * asynchronously after the stream completes. Handles all termination cases:
 * - Normal completion (message_stop event)
 * - Client disconnect
 * - Upstream error
 *
 * Token collection strategy:
 * - input_tokens: from message_start event (always available early in stream)
 * - output_tokens: accumulated from content_block_delta events as fallback,
 *                  overridden by message_delta event when available (final accurate count)
 *
 * @param result - Streaming proxy result
 * @param context - Request context
 * @param env - Cloudflare Workers environment
 * @returns Streaming response
 */
function handleStreamingResponse(
  result: {
    response: Response;
    stream: ReadableStream;
    requestId: string;
    usageContext?: {
      authContext: import("@agate/shared/types").AuthContext;
      apiKeyId: string;
      userId: string;
      departmentId: string | null;
      providerId: string;
      modelId: string;
      modelName: string;
      startTime: number;
    };
  },
  context: RequestContext,
  env: Env
): Response {
  const { response, requestId, usageContext } = result;

  // Log response status
  logResponse(context, 200);

  // If no usage context, return response without usage tracking
  if (!usageContext) {
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, {
      headers,
      status: response.status,
    });
  }

  // Token tracking state
  let inputTokens = 0;
  let outputTokens = 0;
  let accumulatedOutputTokens = 0; // Fallback from content_block_delta
  let buffer = "";
  let streamEnded = false;

  const textDecoder = new TextDecoder();

  // Helper to record usage - called on any stream termination
  const recordUsage = (status: "success" | "error", errorCode?: string | null) => {
    if (streamEnded) return;
    streamEnded = true;

    // Use accumulated output tokens if message_delta never arrived
    const finalOutputTokens = outputTokens > 0 ? outputTokens : accumulatedOutputTokens;

    const usage: AnthropicUsage = {
      input_tokens: inputTokens,
      output_tokens: finalOutputTokens,
    };

    const responseTimeMs = Date.now() - usageContext.startTime;

    // Log warning if tokens appear incomplete
    if (status === "success" && inputTokens === 0 && finalOutputTokens === 0) {
      console.warn(`[${requestId}] Stream completed but no tokens were captured`);
    } else if (status === "error" && (inputTokens === 0 || finalOutputTokens === 0)) {
      console.warn(
        `[${requestId}] Stream terminated with partial token capture: ` +
        `input=${inputTokens}, output=${finalOutputTokens}`
      );
    }

    // Deduct quota if we have tokens and success
    if (status === "success") {
      const quotaService = new QuotaService(env);
      const actualTokens = usage.input_tokens + usage.output_tokens;
      quotaService.deductQuota(usageContext.userId, actualTokens).catch((err) => {
        console.error(`[${requestId}] Failed to deduct quota: ${err}`);
      });
    }

    // Record usage log
    const usageService = new UsageService(env);
    usageService.recordUsage({
      apiKeyId: usageContext.apiKeyId,
      userId: usageContext.userId,
      companyId: null,
      departmentId: usageContext.departmentId,
      providerId: usageContext.providerId,
      modelId: usageContext.modelId,
      modelName: usageContext.modelName,
      endpoint: "/v1/messages",
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      status,
      errorCode: errorCode ?? undefined,
      requestId,
      responseTimeMs,
    }).catch((err) => {
      console.error(`[${requestId}] Failed to record streaming usage: ${err}`);
    });

    // Update last_used_at
    usageService.updateLastUsed(usageContext.apiKeyId).catch((err) => {
      console.error(`[${requestId}] Failed to update last_used_at: ${err}`);
    });
  };

  // Parse SSE data line and extract token information
  const parseSSEData = (dataLine: string) => {
    // Remove "data:" prefix and trim
    const jsonStr = dataLine.slice(5).trim();
    if (!jsonStr || jsonStr === "[DONE]") return;

    try {
      const data = JSON.parse(jsonStr);

      switch (data.type) {
        case 'message_start':
          // Contains input_tokens (always sent early in stream)
          if (data.message?.usage?.input_tokens !== undefined) {
            inputTokens = data.message.usage.input_tokens;
          }
          break;

        case 'content_block_delta':
          // Incremental output tokens - accumulate as fallback
          // This ensures we have some count even if message_delta is lost
          if (data.delta?.type === "content_block_delta" && data.usage?.output_tokens !== undefined) {
            accumulatedOutputTokens += data.usage.output_tokens;
          }
          // Also handle direct usage field
          if (data.usage?.output_tokens !== undefined) {
            // Some providers send incremental tokens, some send cumulative
            // If this is smaller than accumulated, it's likely incremental
            if (data.usage.output_tokens < accumulatedOutputTokens && accumulatedOutputTokens > 0) {
              accumulatedOutputTokens += data.usage.output_tokens;
            } else {
              accumulatedOutputTokens = data.usage.output_tokens;
            }
          }
          break;

        case 'message_delta':
          // Final accurate output token count (sent at end of stream)
          if (data.usage?.output_tokens !== undefined) {
            outputTokens = data.usage.output_tokens;
          }
          break;

        case 'message_stop':
          // Stream completed normally
          break;
      }
    } catch {
      // Ignore JSON parse errors for malformed or incomplete data
    }
  };

  // Process buffer for complete SSE events
  const processBuffer = () => {
    const lines = buffer.split('\n');
    // Keep last (potentially incomplete) line in buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith('data:')) {
        parseSSEData(line);
      }
    }
  };

  // Create a wrapped ReadableStream to handle all termination scenarios
  const reader = result.stream.getReader();

  // Set up error/completion handlers
  reader.closed.catch((err: Error | undefined) => {
    // Stream error (client disconnect or upstream error)
    if (!streamEnded) {
      const errorCode = err?.name === "AbortError" ? "CLIENT_DISCONNECT" : "STREAM_ERROR";
      recordUsage("error", errorCode);
    }
  });

  const wrappedStream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          // Stream ended normally - flush remaining buffer and record
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                parseSSEData(line);
              }
            }
          }
          recordUsage("success");
          controller.close();
          return;
        }

        // Process the chunk
        buffer += textDecoder.decode(value, { stream: true });
        processBuffer();
        controller.enqueue(value);
      } catch (err: unknown) {
        // Read error
        const errorCode = (err as Error)?.name === "AbortError" ? "CLIENT_DISCONNECT" : "STREAM_ERROR";
        recordUsage("error", errorCode);
        controller.error(err);
      }
    },

    cancel(reason: unknown) {
      // Client cancelled the stream
      if (!streamEnded) {
        recordUsage("error", "CLIENT_CANCEL");
      }
    }
  });

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");

  // Add rate limit headers directly to avoid withRateLimitHeaders creating a new Response
  // which would fail due to the stream being locked
  const rateLimit = getRateLimitHeaders(context);
  if (rateLimit) {
    headers.set("RateLimit-Limit", rateLimit["RateLimit-Limit"]);
    headers.set("RateLimit-Remaining", rateLimit["RateLimit-Remaining"]);
    headers.set("RateLimit-Reset", rateLimit["RateLimit-Reset"]);
  }

  return new Response(wrappedStream, {
    headers,
    status: response.status,
  });
}

/**
 * Handles errors from messages endpoint.
 *
 * Records error as usage log for complete request tracking.
 *
 * @param error - Error object
 * @param context - Request context
 * @param env - Cloudflare Workers environment
 * @returns Error response
 */
function handleMessagesError(error: unknown, context: RequestContext, env?: Env): Response {
  // Log the error
  if (error instanceof Error) {
    logError(context, error);
  }

  // Record error as usage log if we have auth context and env
  // This ensures all failed requests are tracked
  if (env && context.auth) {
    const usageService = new UsageService(env);

    // Determine error code
    let errorCode = "UNKNOWN_ERROR";
    if (error instanceof QuotaExceededError) errorCode = "QUOTA_EXCEEDED";
    else if (error instanceof ValidationError) errorCode = "VALIDATION_ERROR";
    else if (error instanceof Error && error.name === "UnauthorizedError") errorCode = "AUTHENTICATION_FAILED";

    // Record error usage log asynchronously (don't block response)
    usageService.recordUsage({
      apiKeyId: context.auth.apiKeyId,
      userId: context.auth.userId,
      companyId: context.auth.companyId,
      departmentId: context.auth.departmentId,
      providerId: "",  // Unknown - request didn't reach provider selection
      modelId: "",     // Unknown
      modelName: "",   // Unknown
      endpoint: "/v1/messages",
      inputTokens: 0,
      outputTokens: 0,
      status: "error",
      errorCode,
      requestId: context.requestId,
      responseTimeMs: Date.now() - context.startTime,
    }).catch((err) => {
      console.error(`Failed to record error usage log: ${err}`);
    });
  }

  // Handle known error types
  if (error instanceof QuotaExceededError) {
    return Response.json(
      {
        error: {
          type: "quota_exceeded_error",
          message: error.message,
        },
      },
      { status: 402 }
    );
  }

  if (error instanceof ValidationError) {
    return Response.json(
      {
        error: {
          type: "invalid_request_error",
          message: error.message,
        },
      },
      { status: 400 }
    );
  }

  // Handle auth errors (401)
  if (error instanceof Error && error.name === "UnauthorizedError") {
    return Response.json(
      {
        error: {
          type: "authentication_error",
          message: error.message,
        },
      },
      { status: 401 }
    );
  }

  // Generic error response
  return Response.json(
    {
      error: {
        type: "internal_error",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}

/**
 * Registers the messages endpoint with a router.
 *
 * @param request - Incoming request
 * @param env - Cloudflare Workers environment
 * @param context - Request context
 * @returns Response or null if route doesn't match
 */
export function messagesRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);

  if (url.pathname === "/v1/messages" && request.method === "POST") {
    return handleMessages(request, env, context);
  }

  return null;
}
