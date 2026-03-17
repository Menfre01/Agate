/**
 * Quotas Management API
 *
 * Admin endpoints for managing quotas.
 *
 * @module api/admin/quotas
 */

import type {
  Env,
  RequestContext,
  EntityType,
  UpdateQuotaDto,
} from "@/types/index.js";
import {
  ValidationError,
  ApiError,
} from "@/utils/errors/index.js";
import { withResponseLogging, logError } from "@/middleware/logger.js";
import { QuotaService } from "@/services/quota.service.js";

/**
 * Handles GET /admin/quotas - List all quotas.
 */
export async function listQuotas(
  _request: Request,
  _env: Env,
  context: RequestContext
): Promise<Response> {
  // Return simplified list for now
  return withResponseLogging(
    Response.json({ quotas: [] }),
    context
  );
}

/**
 * Handles PUT /admin/quotas/:entityType/:entityId - Update quota.
 */
export async function updateQuota(
  request: Request,
  env: Env,
  context: RequestContext,
  entityType: EntityType,
  entityId: string
): Promise<Response> {
  const body = await request.json() as UpdateQuotaDto;

  if (body.quota_type !== "pool" && body.quota_type !== "daily") {
    throw new ValidationError("quota_type must be 'pool' or 'daily'");
  }

  if (typeof body.quota_value !== "number" || body.quota_value < 0) {
    throw new ValidationError("Invalid quota_value");
  }

  const quotaService = new QuotaService(env);
  await quotaService.setQuota(
    entityType,
    entityId,
    body.quota_type,
    body.quota_value,
    body.reason,
    context.auth?.userId
  );

  const quotaInfo = await quotaService.getQuotaInfo(entityType, entityId);

  return withResponseLogging(
    Response.json({
      success: true,
      message: "Quota updated successfully",
      quota: quotaInfo,
    }),
    context
  );
}

/**
 * Handles POST /admin/quotas/:entityType/:entityId/reset - Reset quota.
 */
export async function resetQuota(
  _request: Request,
  env: Env,
  context: RequestContext,
  entityType: EntityType,
  entityId: string
): Promise<Response> {
  const quotaService = new QuotaService(env);
  await quotaService.resetQuota(
    entityType,
    entityId,
    "Manual reset by admin",
    context.auth?.userId
  );

  const quotaInfo = await quotaService.getQuotaInfo(entityType, entityId);

  return withResponseLogging(
    Response.json({
      success: true,
      message: "Quota reset successfully",
      quota: quotaInfo,
    }),
    context
  );
}

/**
 * Handles POST /admin/quotas/:entityType/:entityId/bonus - Add bonus quota.
 */
export async function addBonus(
  request: Request,
  env: Env,
  context: RequestContext,
  entityType: EntityType,
  entityId: string
): Promise<Response> {
  const body: { amount: number; expiry?: number; reason?: string } =
    await request.json();

  if (typeof body.amount !== "number" || body.amount <= 0) {
    throw new ValidationError("Invalid bonus amount");
  }

  const quotaService = new QuotaService(env);
  await quotaService.addBonusQuota(
    entityType,
    entityId,
    body.amount,
    body.expiry,
    body.reason,
    context.auth?.userId
  );

  const quotaInfo = await quotaService.getQuotaInfo(entityType, entityId);

  return withResponseLogging(
    Response.json({
      success: true,
      message: "Bonus quota added successfully",
      amount: body.amount,
      quota: quotaInfo,
    }),
    context
  );
}

/**
 * Routes admin quotas requests.
 */
export function quotasRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/admin/quotas")) {
    return null;
  }

  const parts = pathname.split("/");
  const entityType = parts[3] as EntityType;
  const entityId = parts[4];

  try {
    if (pathname === "/admin/quotas" && request.method === "GET") {
      return listQuotas(request, env, context);
    }

    if (!entityType || !entityId) {
      return Promise.resolve(
        Response.json({ error: "Invalid path" }, { status: 400 })
      );
    }

    if (!["company", "department", "api_key"].includes(entityType)) {
      return Promise.resolve(
        Response.json({ error: "Invalid entity type" }, { status: 400 })
      );
    }

    if (parts.length === 5 && request.method === "PUT") {
      return updateQuota(request, env, context, entityType, entityId);
    }

    if (parts[5] === "reset" && request.method === "POST") {
      return resetQuota(request, env, context, entityType, entityId);
    }

    if (parts[5] === "bonus" && request.method === "POST") {
      return addBonus(request, env, context, entityType, entityId);
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
