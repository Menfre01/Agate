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
  AddModelProviderDto,
} from "@agate/shared/types/index.ts";
import { ModelService } from "@agate/admin/services/model.service.js";
import {
  ValidationError,
  ApiError,
} from "@agate/shared/utils/errors/index.js";
import { withResponseLogging, logError } from "@agate/shared/middleware/logger.js";

/**
 * Handles GET /admin/models - List all models.
 */
export async function listModels(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const pageStr = url.searchParams.get("page");
  const pageSizeStr = url.searchParams.get("page_size");

  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;

  const modelService = new ModelService(env);
  const allModels = await modelService.listModels();

  const total = allModels.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const models = allModels.slice(start, end);

  return withResponseLogging(
    Response.json({
      models,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    }),
    context
  );
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
 * Handles POST /admin/models/:id/providers - Add provider to model.
 */
export async function addModelProvider(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = (await request.json()) as AddModelProviderDto;

  if (!body.provider_id) {
    throw new ValidationError("Missing required field: provider_id");
  }

  const modelService = new ModelService(env);
  const result = await modelService.addProvider(id, body);

  return withResponseLogging(Response.json(result, { status: 201 }), context);
}

/**
 * Handles DELETE /admin/models/:id/providers/:providerId - Remove provider from model.
 */
export async function removeModelProvider(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string,
  providerId: string
): Promise<Response> {
  const modelService = new ModelService(env);
  await modelService.removeProvider(id, providerId);

  return withResponseLogging(
    Response.json({ success: true }),
    context
  );
}

/**
 * Handles GET /admin/models/:id/providers - List providers for model.
 */
export async function listModelProviders(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const modelService = new ModelService(env);
  const providers = await modelService.listProviders(id);

  return withResponseLogging(Response.json({ providers }), context);
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

    // Model provider routes
    if (parts[4] === "providers") {
      const modelId = parts[3];

      if (parts.length === 5 && request.method === "GET") {
        return listModelProviders(request, env, context, modelId!);
      }

      if (parts.length === 5 && request.method === "POST") {
        return addModelProvider(request, env, context, modelId!);
      }

      if (parts.length === 6 && request.method === "DELETE") {
        const providerId = parts[5];
        return removeModelProvider(request, env, context, modelId!, providerId!);
      }
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
