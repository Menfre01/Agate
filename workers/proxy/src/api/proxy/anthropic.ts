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
 * @param ctx - Execution context for waitUntil()
 * @returns Response from upstream or error response
 */
export async function handleMessages(
  request: Request,
  env: Env,
  context: RequestContext,
  ctx: ExecutionContext
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
      return handleStreamingResponse(result, context, env, ctx);
    }

    // For non-streaming: The response has been recreated in ProxyService with a fresh body
    // We need to add CORS and rate limit headers
    const response = result.response;

    // SAFELY add CORS and rate limit headers by modifying the Response directly.
    // This avoids creating a new Response with the body, which could cause
    // "ReadableStream is disturbed" errors in edge cases.
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("X-CORS-Handled", "1");

    // Add rate limit headers
    const rateLimit = getRateLimitHeaders(context);
    if (rateLimit) {
      response.headers.set("RateLimit-Limit", rateLimit["RateLimit-Limit"]);
      response.headers.set("RateLimit-Remaining", rateLimit["RateLimit-Remaining"]);
      response.headers.set("RateLimit-Reset", rateLimit["RateLimit-Reset"]);
    }

    return withResponseLogging(response, context);
  } catch (error) {
    return handleMessagesError(error, context, env);
  }
}

/**
 * Handles streaming response from upstream.
 *
 * Uses tee() to split the stream into two independent branches:
 * 1. One branch for parsing token information and recording usage
 * 2. Another branch for returning to the client
 *
 * This prevents "ReadableStream is disturbed" errors by ensuring each
 * branch has its own independent stream that can be read separately.
 *
 * Token collection strategy (Anthropic SSE format):
 * - input_tokens: from message_start event (always available early in stream)
 * - output_tokens: accumulated from content_block_delta events as fallback,
 *                  overridden by message_delta event when available (final accurate count)
 *
 * SSE event types:
 * - message_start: { type: "message_start", message: { usage: { input_tokens } } }
 * - content_block_start: { type: "content_block_start", index: number }
 * - content_block_delta: { type: "content_block_delta", index: number, delta: { type: "text_delta", text: string } }
 * - content_block_stop: { type: "content_block_stop", index: number }
 * - message_delta: { type: "message_delta", delta: { stop_reason: string }, usage: { output_tokens } }
 * - message_stop: { type: "message_stop" }
 *
 * @param result - Streaming proxy result
 * @param context - Request context
 * @param env - Cloudflare Workers environment
 * @param ctx - Execution context for waitUntil()
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
  env: Env,
  ctx: ExecutionContext
): Response {
  const { response, requestId, usageContext, stream } = result;

  // Check if upstream returned an error status code
  // Even for streaming responses, we need to check the status code before processing
  const status = response.status;
  const isError = status < 200 || status >= 400;

  if (isError) {
    // Log error status
    logResponse(context, status);

    // Record error usage log if context is available
    if (usageContext) {
      const errorUsage = {
        apiKeyId: usageContext.apiKeyId,
        userId: usageContext.userId,
        companyId: null,
        departmentId: usageContext.departmentId,
        providerId: usageContext.providerId,
        modelId: usageContext.modelId,
        modelName: usageContext.modelName,
        endpoint: "/v1/messages",
        inputTokens: 0,
        outputTokens: 0,
        status: "error" as const,
        errorCode: `UPSTREAM_ERROR_${status}`,
        requestId,
        responseTimeMs: Date.now() - usageContext.startTime,
      };

      const usageService = new UsageService(env);
      usageService.recordUsage(errorUsage).catch((err) => {
        console.error(`[${requestId}] Failed to record error usage: ${err}`);
      });
    }

    // Pass through the upstream error response directly to the client
    // This preserves the original error content and content-type
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-CORS-Handled", "1");

    // Return the upstream stream directly - no tee() needed for error responses
    // since we're not doing any parsing
    return new Response(stream, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }

  // Log success status
  logResponse(context, 200);

  // Always use tee() to split the stream, even without usage context
  // This ensures the stream is properly handled and prevents "Body has already been used" errors
  // by creating independent branches for any potential consumption
  const [parseBranch, clientBranch] = stream.tee();

  // Parse stream asynchronously and use waitUntil() to ensure completion
  // CRITICAL: In Cloudflare Workers, async tasks started after returning Response
  // may be cancelled. Using waitUntil() ensures the task completes even after
  // the response is sent to the client.
  if (usageContext) {
    ctx.waitUntil(
      parseStreamForUsage(parseBranch, requestId, usageContext, env).catch((err) => {
        console.error(`[${requestId}] Failed to parse stream for usage: ${err}`);
      })
    );
  } else {
    // No usage context - still need to consume the parse branch to avoid hanging
    // The client branch will be read by the client, but the parse branch must also be consumed
    ctx.waitUntil(
      consumeStreamQuietly(parseBranch, requestId).catch((err) => {
        console.error(`[${requestId}] Failed to consume parse branch: ${err}`);
      })
    );
  }

  // Build response headers with CORS and rate limit
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  // Add a marker to indicate CORS headers are already handled
  headers.set("X-CORS-Handled", "1");

  // Add rate limit headers
  const rateLimit = getRateLimitHeaders(context);
  if (rateLimit) {
    headers.set("RateLimit-Limit", rateLimit["RateLimit-Limit"]);
    headers.set("RateLimit-Remaining", rateLimit["RateLimit-Remaining"]);
    headers.set("RateLimit-Reset", rateLimit["RateLimit-Reset"]);
  }

  // Return the client branch - this stream is independent and can be read by the client
  // without affecting the parsing branch
  return new Response(clientBranch, {
    headers,
    status: response.status,
  });
}

/**
 * Consumes a stream without processing it.
 * Used when we need to drain a stream branch but don't care about its content.
 *
 * @param stream - The stream to consume
 * @param requestId - Request ID for logging
 */
async function consumeStreamQuietly(stream: ReadableStream, requestId: string): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (err) {
    console.warn(`[${requestId}] Error consuming stream quietly: ${err}`);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses the stream to extract token usage information and record it.
 *
 * This function consumes the parseBranch completely and is non-blocking
 * (runs asynchronously while the client receives the response).
 *
 * @param stream - The parse branch of the teed stream
 * @param requestId - Request ID for logging
 * @param usageContext - Usage recording context
 * @param env - Cloudflare Workers environment
 */
async function parseStreamForUsage(
  stream: ReadableStream,
  requestId: string,
  usageContext: {
    authContext: import("@agate/shared/types").AuthContext;
    apiKeyId: string;
    userId: string;
    departmentId: string | null;
    providerId: string;
    modelId: string;
    modelName: string;
    startTime: number;
  },
  env: Env
): Promise<void> {
  // Token tracking state
  let inputTokens = 0;
  let outputTokens = 0;
  let accumulatedOutputTokens = 0; // Fallback from content_block_delta
  let buffer = "";

  const textDecoder = new TextDecoder();
  const reader = stream.getReader();

  // Helper to record usage - called on any stream termination
  const recordUsage = (status: "success" | "error", errorCode?: string | null) => {
    // Use accumulated output tokens if message_delta never arrived
    const finalOutputTokens = outputTokens > 0 ? outputTokens : accumulatedOutputTokens;

    const usage: AnthropicUsage = {
      input_tokens: inputTokens,
      output_tokens: finalOutputTokens,
    };

    const responseTimeMs = Date.now() - usageContext.startTime;

    // Log final token counts for debugging
    console.log(
      `[${requestId}] Recording usage - status: ${status}, ` +
      `input_tokens: ${inputTokens}, output_tokens: ${finalOutputTokens}, ` +
      `events_received: ${eventCount}`
    );

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

  // Event counter for debugging (log first few events)
  let eventCount = 0;
  const MAX_EVENT_LOGS = 3;

  // Parse SSE data line and extract token information
  const parseSSEData = (dataLine: string) => {
    // Remove "data:" prefix and trim
    const jsonStr = dataLine.slice(5).trim();
    if (!jsonStr || jsonStr === "[DONE]") return;

    // Log first few events for debugging
    if (eventCount < MAX_EVENT_LOGS) {
      console.log(`[${requestId}] SSE event #${eventCount + 1}: ${jsonStr.substring(0, 500)}`);
      eventCount++;
    }

    try {
      const data = JSON.parse(jsonStr);

      switch (data.type) {
        case 'message_start':
          // Contains input_tokens (always sent early in stream)
          // Format: { type: "message_start", message: { id, type, role, content, usage: { input_tokens } } }
          if (data.message?.usage?.input_tokens !== undefined) {
            const rawInputTokens = data.message.usage.input_tokens;
            console.log(`[${requestId}] Raw input_tokens from message_start: ${rawInputTokens} (${typeof rawInputTokens})`);
            // Clamp to non-negative
            inputTokens = Math.max(0, rawInputTokens);
            if (rawInputTokens < 0) {
              console.warn(`[${requestId}] Negative input_tokens clamped from ${rawInputTokens} to ${inputTokens}`);
            }
            console.log(`[${requestId}] Captured input_tokens from message_start: ${inputTokens}`);
          } else {
            // Log warning if input_tokens is missing from message_start
            console.warn(
              `[${requestId}] message_start event missing usage.input_tokens. ` +
              `Event keys: ${Object.keys(data).join(', ')}, ` +
              `message keys: ${data.message ? Object.keys(data.message).join(', ') : 'null'}`
            );
          }
          break;

        case 'content_block_delta':
          // Contains incremental delta, not usage field in standard Anthropic format
          // Format: { type: "content_block_delta", index: number, delta: { type: "text_delta"|"input_json_delta", text?: string, partial_json?: string } }
          // NOTE: Standard Anthropic API does NOT include usage in content_block_delta
          // Some third-party providers may include it, so we handle it as a fallback
          if (data.usage?.output_tokens !== undefined) {
            // Determine if this is incremental or cumulative based on value
            // If current value is much smaller than accumulated, it's likely incremental
            // Otherwise, treat as cumulative (replace accumulated value)
            if (data.usage.output_tokens < accumulatedOutputTokens && accumulatedOutputTokens > 0) {
              // Likely incremental - add to accumulated
              accumulatedOutputTokens += data.usage.output_tokens;
            } else {
              // Likely cumulative - replace accumulated value
              accumulatedOutputTokens = data.usage.output_tokens;
            }
          }
          // Standard approach: count each content_block_delta as having some tokens
          // We'll use message_delta for accurate counting, but track deltas as rough estimate
          break;

        case 'message_delta':
          // Final accurate output token count (sent at end of stream)
          // Format: { type: "message_delta", delta: { stop_reason: "end_turn"|"max_tokens"|"stop_sequence" }, usage: { output_tokens } }
          if (data.usage?.output_tokens !== undefined) {
            const rawOutputTokens = data.usage.output_tokens;
            console.log(`[${requestId}] Raw output_tokens from message_delta: ${rawOutputTokens} (${typeof rawOutputTokens})`);
            // Clamp to non-negative
            outputTokens = Math.max(0, rawOutputTokens);
            if (rawOutputTokens < 0) {
              console.warn(`[${requestId}] Negative output_tokens clamped from ${rawOutputTokens} to ${outputTokens}`);
            }
            console.log(`[${requestId}] Captured output_tokens from message_delta: ${outputTokens}`);
          }
          break;

        case 'message_stop':
          // Stream completed normally
          // Format: { type: "message_stop" }
          console.log(`[${requestId}] Received message_stop, stream completed`);
          break;

        case 'content_block_start':
        case 'content_block_stop':
          // These events don't contain usage information
          // content_block_start: { type: "content_block_start", index: number, content_block: { type, text } }
          // content_block_stop: { type: "content_block_stop", index: number }
          break;

        case 'ping':
          // Keep-alive ping, ignore
          break;

        case 'error':
          // Error event from upstream
          // Format: { type: "error", error: { type, message } }
          console.warn(`[${requestId}] Error event in stream: ${data.error?.message}`);
          break;

        default:
          // Log unknown event types for debugging
          console.log(`[${requestId}] Unknown SSE event type: ${data.type}`);
          break;
      }
    } catch (parseErr) {
      // Log JSON parse errors for debugging (don't throw, just log)
      console.error(
        `[${requestId}] Failed to parse SSE data: ${parseErr}. ` +
        `Data line (first 200 chars): ${jsonStr.substring(0, 200)}`
      );
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

  try {
    while (true) {
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
        break;
      }

      // Process the chunk
      buffer += textDecoder.decode(value, { stream: true });
      processBuffer();
    }
  } catch (err: unknown) {
    // Read error - could be client disconnect, network error, or malformed SSE
    const errorCode = (err as Error)?.name === "AbortError" ? "CLIENT_DISCONNECT" : "STREAM_ERROR";
    recordUsage("error", errorCode);
  } finally {
    // Always release the reader lock to prevent resource leaks
    reader.releaseLock();
  }
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

  // Build error response object
  let errorResponseBody: { error: { type: string; message: string } };
  let status: number;

  // Handle known error types
  if (error instanceof QuotaExceededError) {
    errorResponseBody = {
      error: {
        type: "quota_exceeded_error",
        message: error.message,
      },
    };
    status = 402;
  } else if (error instanceof ValidationError) {
    errorResponseBody = {
      error: {
        type: "invalid_request_error",
        message: error.message,
      },
    };
    status = 400;
  } else if (error instanceof Error && error.name === "UnauthorizedError") {
    errorResponseBody = {
      error: {
        type: "authentication_error",
        message: error.message,
      },
    };
    status = 401;
  } else {
    // Generic error response
    errorResponseBody = {
      error: {
        type: "internal_error",
        message: "An unexpected error occurred",
      },
    };
    status = 500;
  }

  // Create response with CORS headers already set
  // This prevents withCorsHeaders from trying to process the response
  const response = Response.json(errorResponseBody, { status });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("X-CORS-Handled", "1");

  return response;
}

/**
 * Registers the messages endpoint with a router.
 *
 * @param request - Incoming request
 * @param env - Cloudflare Workers environment
 * @param context - Request context
 * @param ctx - Execution context for waitUntil()
 * @returns Response or null if route doesn't match
 */
export function messagesRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext,
  ctx: ExecutionContext
): Promise<Response> | null {
  const url = new URL(request.url);

  if (url.pathname === "/v1/messages" && request.method === "POST") {
    return handleMessages(request, env, context, ctx);
  }

  return null;
}
