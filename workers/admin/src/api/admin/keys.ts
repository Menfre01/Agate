/**
 * API Keys Management API
 *
 * Admin endpoints for managing API keys.
 *
 * @module api/admin/keys
 */

import type {
  Env,
  RequestContext,
  CreateApiKeyDto,
  UpdateApiKeyDto,
  AddBonusQuotaDto,
} from "@agate/shared/types";
import { KeyService } from "@agate/admin/services/key.service.js";
import {
  ValidationError,
  ApiError,
} from "@agate/shared/utils/errors/index.js";
import { withResponseLogging, logError } from "@agate/shared/middleware/logger.js";

/**
 * Handles GET /admin/keys - List all API keys.
 */
export async function listKeys(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(_request.url);

  const userId = url.searchParams.get("user_id") ?? undefined;
  const companyId = url.searchParams.get("company_id") ?? undefined;
  const departmentId = url.searchParams.get("department_id") ?? undefined;
  const isActive = url.searchParams.get("is_active");
  const search = url.searchParams.get("search");
  const pageStr = url.searchParams.get("page");
  const pageSizeStr = url.searchParams.get("page_size");

  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;

  const keyService = new KeyService(env);
  const keys = await keyService.listApiKeys({
    user_id: userId,
    company_id: companyId,
    department_id: departmentId,
  });

  // Apply filters
  let filteredKeys = keys;
  if (isActive && isActive !== 'null' && isActive !== '') {
    const activeBool = isActive === 'true';
    filteredKeys = filteredKeys.filter((k: any) => k.is_active === activeBool);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    filteredKeys = filteredKeys.filter((k: any) =>
      (k.key_prefix && k.key_prefix.toLowerCase().includes(searchLower)) ||
      (k.user_email && k.user_email.toLowerCase().includes(searchLower)) ||
      (k.name && k.name.toLowerCase().includes(searchLower))
    );
  }

  // Apply pagination
  const total = filteredKeys.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedKeys = filteredKeys.slice(startIndex, endIndex);

  return withResponseLogging(
    Response.json({
      keys: paginatedKeys,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    }),
    context
  );
}

/**
 * Handles POST /admin/keys - Create new API key.
 */
export async function createKey(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const body = (await request.json()) as CreateApiKeyDto;

  if (!body.user_id) {
    throw new ValidationError("Missing required field: user_id");
  }
  if (!body.name) {
    throw new ValidationError("Missing required field: name");
  }

  const keyService = new KeyService(env);
  const result = await keyService.createApiKey(body);

  return withResponseLogging(
    Response.json({ ...result.response, key: result.key }, { status: 201 }),
    context
  );
}

/**
 * Handles GET /admin/keys/:id - Get API key details.
 */
export async function getKey(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const keyService = new KeyService(env);
  const response = await keyService.getApiKey(id);

  return withResponseLogging(Response.json(response), context);
}

/**
 * Handles PUT /admin/keys/:id - Update API key.
 */
export async function updateKey(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = (await request.json()) as UpdateApiKeyDto;
  const keyService = new KeyService(env);

  const response = await keyService.updateApiKey(id, body);

  return withResponseLogging(Response.json(response), context);
}

/**
 * Handles DELETE /admin/keys/:id - Delete API key.
 */
export async function deleteKey(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const keyService = new KeyService(env);
  await keyService.deleteApiKey(id);

  return withResponseLogging(
    Response.json({ success: true, message: "API key deleted" }),
    context
  );
}

/**
 * Handles POST /admin/keys/:id/disable - Disable API key.
 */
export async function disableKey(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const keyService = new KeyService(env);
  await keyService.disableApiKey(id);

  return withResponseLogging(
    Response.json({ success: true, message: "API key disabled" }),
    context
  );
}

/**
 * Handles POST /admin/keys/:id/enable - Enable API key.
 */
export async function enableKey(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const keyService = new KeyService(env);
  await keyService.enableApiKey(id);

  return withResponseLogging(
    Response.json({ success: true, message: "API key enabled" }),
    context
  );
}

/**
 * Handles POST /admin/keys/:id/bonus - Add bonus quota.
 */
export async function addBonusQuota(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = (await request.json()) as AddBonusQuotaDto;

  if (typeof body.amount !== "number" || body.amount <= 0) {
    throw new ValidationError("Invalid bonus amount");
  }

  const keyService = new KeyService(env);
  const response = await keyService.addBonusQuota(id, body);

  return withResponseLogging(
    Response.json({
      success: true,
      message: "Bonus quota added",
      amount: body.amount,
      quota: response,
    }),
    context
  );
}

/**
 * Routes admin API keys requests.
 */
export function keysRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/admin/keys")) {
    return null;
  }

  const parts = pathname.split("/");
  const id = parts[3];

  try {
    if (pathname === "/admin/keys" && request.method === "GET") {
      return listKeys(request, env, context);
    }

    if (pathname === "/admin/keys" && request.method === "POST") {
      return createKey(request, env, context);
    }

    if (!id) {
      return Promise.resolve(
        Response.json({ error: "Invalid path" }, { status: 400 })
      );
    }

    if (parts.length === 4 && request.method === "GET") {
      return getKey(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "PUT") {
      return updateKey(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "DELETE") {
      return deleteKey(request, env, context, id);
    }

    if (parts[4] === "disable" && request.method === "POST") {
      return disableKey(request, env, context, id);
    }

    if (parts[4] === "enable" && request.method === "POST") {
      return enableKey(request, env, context, id);
    }

    if (parts[4] === "bonus" && request.method === "POST") {
      return addBonusQuota(request, env, context, id);
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
