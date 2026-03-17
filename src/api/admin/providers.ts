/**
 * Providers Management API
 *
 * Admin endpoints for managing AI providers.
 *
 * @module api/admin/providers
 */

import type {
  Env,
  RequestContext,
  CreateProviderDto,
  UpdateProviderDto,
  AddProviderCredentialDto,
  ProviderCredentialResponse,
} from "@/types/index.js";
import { ProviderService } from "@/services/provider.service.js";
import {
  ValidationError,
  NotFoundError,
  ApiError,
} from "@/utils/errors/index.js";
import { withResponseLogging, logError } from "@/middleware/logger.js";
import * as queries from "@/db/queries.js";

/**
 * Handles GET /admin/providers - List all providers.
 */
export async function listProviders(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const providerService = new ProviderService(env);
  const providers = await providerService.listProviders();

  return withResponseLogging(Response.json({ providers }), context);
}

/**
 * Handles POST /admin/providers - Create new provider.
 */
export async function createProvider(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const body = (await request.json()) as CreateProviderDto;

  if (!body.name) {
    throw new ValidationError("Missing required field: name");
  }
  if (!body.display_name) {
    throw new ValidationError("Missing required field: display_name");
  }
  if (!body.base_url) {
    throw new ValidationError("Missing required field: base_url");
  }

  try {
    new URL(body.base_url);
  } catch {
    throw new ValidationError("Invalid base_url format");
  }

  const providerService = new ProviderService(env);
  const provider = await providerService.createProvider(body);

  return withResponseLogging(Response.json(provider, { status: 201 }), context);
}

/**
 * Handles GET /admin/providers/:id - Get provider details.
 */
export async function getProvider(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const providerService = new ProviderService(env);
  const provider = await providerService.getProvider(id);

  return withResponseLogging(Response.json(provider), context);
}

/**
 * Handles PUT /admin/providers/:id - Update provider.
 */
export async function updateProvider(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = (await request.json()) as UpdateProviderDto;

  if (body.base_url) {
    try {
      new URL(body.base_url);
    } catch {
      throw new ValidationError("Invalid base_url format");
    }
  }

  const providerService = new ProviderService(env);
  const updated = await providerService.updateProvider(id, body);

  return withResponseLogging(Response.json(updated), context);
}

/**
 * Handles DELETE /admin/providers/:id - Delete provider.
 */
export async function deleteProvider(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const providerService = new ProviderService(env);
  await providerService.deleteProvider(id);

  return withResponseLogging(
    Response.json({ success: true, message: "Provider deleted" }),
    context
  );
}

/**
 * Handles POST /admin/providers/:id/credentials - Add provider credential.
 */
export async function addCredential(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = (await request.json()) as AddProviderCredentialDto;

  if (!body.credential_name) {
    throw new ValidationError("Missing required field: credential_name");
  }
  if (!body.api_key) {
    throw new ValidationError("Missing required field: api_key");
  }

  const existing = await queries.getProvider(env.DB, id);
  if (!existing) {
    throw new NotFoundError("Provider", id);
  }

  const providerService = new ProviderService(env);
  const credential = await providerService.addCredential(id, {
    credential_name: body.credential_name,
    api_key: body.api_key,
    base_url: body.base_url,
    priority: body.priority ?? 0,
    weight: body.weight ?? 1,
  });

  const response: ProviderCredentialResponse = {
    id: credential.id,
    credential_name: credential.credential_name,
    base_url: credential.base_url,
    is_active: Boolean(credential.is_active),
    priority: credential.priority,
    weight: credential.weight,
    health_status: credential.health_status,
    last_health_check: credential.last_health_check,
    created_at: credential.created_at,
  };

  return withResponseLogging(Response.json(response, { status: 201 }), context);
}

/**
 * Routes admin providers requests.
 */
export function providersRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/admin/providers")) {
    return null;
  }

  const parts = pathname.split("/");
  const id = parts[3];

  try {
    if (pathname === "/admin/providers" && request.method === "GET") {
      return listProviders(request, env, context);
    }

    if (pathname === "/admin/providers" && request.method === "POST") {
      return createProvider(request, env, context);
    }

    if (!id) {
      return Promise.resolve(
        Response.json({ error: "Invalid path" }, { status: 400 })
      );
    }

    if (parts.length === 4 && request.method === "GET") {
      return getProvider(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "PUT") {
      return updateProvider(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "DELETE") {
      return deleteProvider(request, env, context, id);
    }

    if (parts[4] === "credentials" && request.method === "POST") {
      return addCredential(request, env, context, id);
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
