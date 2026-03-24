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
} from "@agate/shared/types";
import { ProviderService } from "@agate/admin/services/provider.service.js";
import {
  ValidationError,
  NotFoundError,
  ApiError,
} from "@agate/shared/utils/errors/index.js";
import { withResponseLogging, logError } from "@agate/shared/middleware/logger.js";
import * as queries from "@agate/shared/db/queries.js";

/**
 * Handles GET /admin/providers - List all providers.
 */
export async function listProviders(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const pageStr = url.searchParams.get("page");
  const pageSizeStr = url.searchParams.get("page_size");

  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;

  const providerService = new ProviderService(env);
  const allProviders = await providerService.listProviders();

  const total = allProviders.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const providers = allProviders.slice(start, end);

  return withResponseLogging(
    Response.json({
      providers,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    }),
    context
  );
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
 * Handles GET /admin/providers/:id/credentials - List provider credentials.
 */
export async function listCredentials(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const providerService = new ProviderService(env);
  const credentials = await providerService.listCredentials(id);

  return withResponseLogging(Response.json({ credentials }), context);
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
  });

  // credential is already ProviderCredentialResponse
  return withResponseLogging(Response.json(credential, { status: 201 }), context);
}

/**
 * Handles DELETE /admin/providers/credentials/:id - Delete provider credential.
 */
export async function deleteCredential(
  _request: Request,
  env: Env,
  context: RequestContext,
  credentialId: string
): Promise<Response> {
  const providerService = new ProviderService(env);
  await providerService.deleteCredential(credentialId);

  return withResponseLogging(
    Response.json({ success: true, message: "Credential deleted" }),
    context
  );
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
    // Special case: /admin/providers/credentials/:credentialId (direct credential operations)
    if (parts[3] === "credentials") {
      if (parts.length === 5 && request.method === "DELETE") {
        const credentialId = parts[4];
        if (credentialId) {
          return deleteCredential(request, env, context, credentialId);
        }
      }
      // Invalid path for credentials without provider ID
      return Promise.resolve(
        Response.json({ error: "Invalid path" }, { status: 400 })
      );
    }

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

    if (parts[4] === "credentials" && request.method === "GET") {
      return listCredentials(request, env, context, id);
    }

    if (parts[4] === "credentials" && request.method === "POST") {
      return addCredential(request, env, context, id);
    }

    // DELETE /admin/providers/:id/credentials/:credentialId (nested route, backward compatibility)
    if (parts[4] === "credentials" && parts.length === 6 && request.method === "DELETE") {
      const credentialId = parts[5];
      if (credentialId) {
        return deleteCredential(request, env, context, credentialId);
      }
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
