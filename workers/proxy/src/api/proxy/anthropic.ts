/**
 * Anthropic Messages API Proxy
 *
 * Proxies requests to Anthropic's Messages API (/v1/messages)
 * with authentication, quota checking, and usage tracking.
 *
 * @module api/proxy/anthropic
 */

import type { Env, RequestContext, ProxyMessageRequest } from "@agate/shared/types";
import { validateRequestAuth } from "@agate/proxy/middleware/auth.js";
import { ProxyService } from "@agate/proxy/services/proxy.service.js";
import { QuotaExceededError, ValidationError } from "@agate/shared/utils/errors";
import { logError, withResponseLogging } from "@agate/shared/middleware/logger";

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

    // Forward to upstream
    const proxyService = new ProxyService(env);
    const result = await proxyService.forwardMessage(authContext, body);

    // For streaming responses, we need to handle the stream
    if (result.streaming) {
      return handleStreamingResponse(result, context);
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
 * @param result - Streaming proxy result
 * @param context - Request context
 * @returns Streaming response
 */
function handleStreamingResponse(
  result: { response: Response; stream: ReadableStream; requestId: string },
  context: RequestContext
): Response {
  const { response, stream } = result;

  // Create a transform stream to capture usage from message_delta events
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      // Forward the chunk as-is
      controller.enqueue(chunk);
    },
  });

  // Pipe the stream through the transformer
  const transformedStream = stream.pipeThrough(transformStream);

  // Create new response with transformed stream
  const streamingResponse = new Response(transformedStream, {
    headers: response.headers,
    status: response.status,
  });

  return withResponseLogging(streamingResponse, context);
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
