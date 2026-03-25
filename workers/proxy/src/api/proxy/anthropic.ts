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
    return handleMessagesError(error, context);
  }
}

/**
 * Handles streaming response from upstream.
 *
 * Intercepts SSE events to extract usage information and records it
 * asynchronously after the stream completes.
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
    // Copy headers and add CORS
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, {
      headers,
      status: response.status,
    });
  }

  // Parse usage from stream events
  // Anthropic streaming format:
  // - message_start: contains input_tokens in data.message.usage
  // - message_delta: contains final output_tokens in data.usage
  // - message_stop: no usage data
  let inputTokens = 0;
  let outputTokens = 0;

  const transformStream = new TransformStream({
    transform(chunk: Uint8Array, controller) {
      // Forward chunk to client immediately
      controller.enqueue(chunk);

      // Try to parse usage from SSE events
      const text = new TextDecoder().decode(chunk);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim());

            // message_start: contains input_tokens
            if (data.type === 'message_start' && data.message?.usage) {
              inputTokens = data.message.usage.input_tokens ?? 0;
            }

            // message_delta: contains final output_tokens
            if (data.type === 'message_delta' && data.usage) {
              outputTokens = data.usage.output_tokens ?? 0;
            }
          } catch {
            // Ignore parsing errors for non-JSON lines
          }
        }
      }
    },

    flush() {
      // Stream ended - record usage if captured
      if (inputTokens > 0 || outputTokens > 0) {
        const usage: AnthropicUsage = {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        };
        // Record usage asynchronously (don't block response)
        recordStreamingUsage(usage, requestId, usageContext, env, context)
          .catch((err) => {
            // Log error but don't fail the request
            console.error(`Failed to record streaming usage: ${err}`);
          });
      }
    }
  });

  // Pipe the stream through the transformer
  const transformedStream = response.body!.pipeThrough(transformStream);

  // Copy headers and add CORS
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");

  // Create new response with the transformed stream (with CORS headers already added)
  return new Response(transformedStream, {
    headers,
    status: response.status,
  });
}

/**
 * Records usage after streaming response completes.
 *
 * @param usage - Token usage from stream
 * @param requestId - Request ID
 * @param usageContext - Usage recording context
 * @param env - Cloudflare Workers environment
 * @param context - Request context
 */
async function recordStreamingUsage(
  usage: AnthropicUsage,
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
  env: Env,
  context: RequestContext
): Promise<void> {
  const responseTimeMs = Date.now() - usageContext.startTime;

  // Deduct quota (Phase 1: only for system user)
  const quotaService = new QuotaService(env);
  const actualTokens = usage.input_tokens + usage.output_tokens;
  await quotaService.deductQuota(usageContext.userId, actualTokens);

  // Record usage
  const usageService = new UsageService(env);
  await usageService.recordUsage({
    apiKeyId: usageContext.apiKeyId,
    userId: usageContext.userId,
    companyId: null,  // PRD V2 Phase 1: no company
    departmentId: usageContext.departmentId,
    providerId: usageContext.providerId,
    modelId: usageContext.modelId,
    modelName: usageContext.modelName,
    endpoint: "/v1/messages",
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    status: "success",
    requestId,
    responseTimeMs,
  });

  // Update last_used_at
  await usageService.updateLastUsed(usageContext.apiKeyId);
}

/**
 * Handles errors from messages endpoint.
 *
 * @param error - Error object
 * @param context - Request context
 * @param env - Cloudflare Workers environment
 * @returns Error response
 */
function handleMessagesError(error: unknown, context: RequestContext): Response {
  // Log the error
  if (error instanceof Error) {
    logError(context, error);
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
