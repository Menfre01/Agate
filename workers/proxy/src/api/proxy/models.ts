/**
 * Models List API
 *
 * Returns list of available models for the authenticated user.
 * Anthropic-compatible format for Claude Code compatibility.
 *
 * @module api/proxy/models
 */

import type { Env, RequestContext } from "@agate/shared/types";
import { validateRequestAuth } from "@agate/proxy/middleware/auth.js";
import { ModelService } from "@agate/proxy/services/model.service.js";
import { withResponseLogging } from "@agate/shared/middleware/logger";

/**
 * Model list entry format (Anthropic-compatible).
 *
 * Anthropic's actual /v1/models response format:
 * - id: model identifier (e.g., "claude-3-5-sonnet-20241022")
 * - display_name: human-readable name
 * - type: always "model"
 */
interface ModelListEntry {
  id: string;
  display_name: string;
  type: string;
}

/**
 * Models list response format (Anthropic-compatible).
 *
 * Matches Anthropic's /v1/models response structure.
 */
interface ModelsListResponse {
  object: string;
  data: ModelListEntry[];
}

/**
 * Handles GET /v1/models requests.
 *
 * Returns Anthropic-compatible model list for Claude Code.
 */
export async function handleModels(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const authContext = await validateRequestAuth(request, env);
  context.auth = authContext;

  const modelService = new ModelService(env);
  const models = await modelService.listModels();

  const data: ModelListEntry[] = models
    .filter((model) => model.is_active)
    .map((model) => ({
      id: model.model_id,
      display_name: model.display_name,
      type: "model",
    }));

  const response: ModelsListResponse = {
    object: "list",
    data,
  };

  return withResponseLogging(
    Response.json(response),
    context
  );
}

/**
 * Registers the models endpoint with a router.
 */
export function modelsRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);

  if (url.pathname === "/v1/models" && request.method === "GET") {
    return handleModels(request, env, context);
  }

  return null;
}
