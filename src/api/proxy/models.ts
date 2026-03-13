/**
 * Models List API
 *
 * Returns list of available models for the authenticated user.
 *
 * @module api/proxy/models
 */

import type { Env, RequestContext } from "@/types/index.js";
import { validateRequestAuth } from "@/middleware/auth.js";
import { ModelService } from "@/services/model.service.js";
import { withResponseLogging } from "@/middleware/logger.js";

/**
 * Model list entry format.
 */
interface ModelListEntry {
  id: string;
  name: string;
  context_length: number;
  max_tokens: number;
}

/**
 * Models list response format (Anthropic-compatible).
 */
interface ModelsListResponse {
  object: string;
  data: ModelListEntry[];
}

/**
 * Handles GET /v1/models requests.
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

  const data: ModelListEntry[] = models.map((model) => ({
    id: model.model_id,
    name: model.display_name,
    context_length: model.context_window,
    max_tokens: model.max_tokens,
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
