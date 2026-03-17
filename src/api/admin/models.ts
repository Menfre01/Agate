/**
 * Models Management API
 *
 * Admin endpoints for managing AI models.
 *
 * @module api/admin/models
 */

import type {
  Env,
  RequestContext,
  CreateModelDto,
  UpdateModelDto,
} from "@/types/index.js";
import { ModelService } from "@/services/model.service.js";
import {
  ValidationError,
  ApiError,
} from "@/utils/errors/index.js";
import { withResponseLogging, logError } from "@/middleware/logger.js";

/**
 * Handles GET /admin/models - List all models.
 */
export async function listModels(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const modelService = new ModelService(env);
  const models = await modelService.listModels();

  return withResponseLogging(Response.json({ models }), context);
}

/**
 * Handles POST /admin/models - Create new model.
 */
export async function createModel(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const body = (await request.json()) as CreateModelDto;

  if (!body.model_id) {
    throw new ValidationError("Missing required field: model_id");
  }
  if (!body.display_name) {
    throw new ValidationError("Missing required field: display_name");
  }
  if (!body.provider_id) {
    throw new ValidationError("Missing required field: provider_id");
  }

  const modelService = new ModelService(env);
  const model = await modelService.createModel(body);

  return withResponseLogging(Response.json(model, { status: 201 }), context);
}

/**
 * Handles GET /admin/models/:id - Get model details.
 */
export async function getModel(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const modelService = new ModelService(env);
  const model = await modelService.getModel(id);

  return withResponseLogging(Response.json(model), context);
}

/**
 * Handles PUT /admin/models/:id - Update model.
 */
export async function updateModel(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = (await request.json()) as UpdateModelDto;
  const modelService = new ModelService(env);

  const model = await modelService.updateModel(id, body);

  return withResponseLogging(Response.json(model), context);
}

/**
 * Handles DELETE /admin/models/:id - Delete model.
 */
export async function deleteModel(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const modelService = new ModelService(env);
  await modelService.deleteModel(id);

  return withResponseLogging(
    Response.json({ success: true, message: "Model deleted" }),
    context
  );
}

/**
 * Routes admin models requests.
 */
export function modelsRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/admin/models")) {
    return null;
  }

  const parts = pathname.split("/");
  const id = parts[3];

  try {
    if (pathname === "/admin/models" && request.method === "GET") {
      return listModels(request, env, context);
    }

    if (pathname === "/admin/models" && request.method === "POST") {
      return createModel(request, env, context);
    }

    if (!id) {
      return Promise.resolve(
        Response.json({ error: "Invalid path" }, { status: 400 })
      );
    }

    if (parts.length === 4 && request.method === "GET") {
      return getModel(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "PUT") {
      return updateModel(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "DELETE") {
      return deleteModel(request, env, context, id);
    }

    return Promise.resolve(
      Response.json({ error: "Method not allowed" }, { status: 405 })
    );
  } catch (error) {
    if (error instanceof ApiError) {
      logError(context, error);
      return Promise.resolve(
        Response.json({ error: error.message }, { status: error.statusCode })
      );
    }
    if (error instanceof Error) {
      logError(context, error);
    }
    return Promise.resolve(
      Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      )
    );
  }
}
