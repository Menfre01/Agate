/**
 * Departments Management API
 *
 * Admin endpoints for managing departments.
 *
 * @module api/admin/departments
 */

import type {
  Env,
  RequestContext,
} from "@/types/index.js";
import type { CreateDepartmentDto, UpdateDepartmentDto } from "@/db/queries.js";
import * as queries from "@/db/queries.js";
import {
  ValidationError,
  NotFoundError,
  ApiError,
} from "@/utils/errors/index.js";
import { withResponseLogging, logError } from "@/middleware/logger.js";

/**
 * Handles GET /admin/departments - List departments.
 */
export async function listDepartments(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("company_id");

  const departments = companyId
    ? await queries.listDepartmentsByCompany(env.DB, companyId)
    : await queries.listAllDepartments(env.DB);

  return withResponseLogging(
    Response.json({ departments }),
    context
  );
}

/**
 * Handles POST /admin/departments - Create new department.
 */
export async function createDepartment(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const body = await request.json() as { id?: string; company_id: string; name: string; quota_pool?: number; quota_daily?: number };

  // Generate ID if not provided
  const data: CreateDepartmentDto = {
    id: body.id || `dept_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    company_id: body.company_id,
    name: body.name,
    quota_pool: body.quota_pool ?? 0,
    quota_daily: body.quota_daily ?? 0,
  };

  if (!data.company_id) {
    throw new ValidationError("Missing required field: company_id");
  }
  if (!data.name) {
    throw new ValidationError("Missing required field: name");
  }

  // Verify company exists
  const company = await queries.getCompany(env.DB, data.company_id);
  if (!company) {
    throw new NotFoundError("Company", data.company_id);
  }

  const department = await queries.createDepartment(env.DB, data);

  return withResponseLogging(
    Response.json(department, { status: 201 }),
    context
  );
}

/**
 * Handles GET /admin/departments/:id - Get department details.
 */
export async function getDepartment(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const department = await queries.getDepartment(env.DB, id);

  if (!department) {
    throw new NotFoundError("Department", id);
  }

  return withResponseLogging(Response.json(department), context);
}

/**
 * Handles PUT /admin/departments/:id - Update department.
 */
export async function updateDepartment(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = await request.json() as UpdateDepartmentDto;
  const department = await queries.updateDepartment(env.DB, id, body);

  return withResponseLogging(Response.json(department), context);
}

/**
 * Handles DELETE /admin/departments/:id - Delete department.
 */
export async function deleteDepartment(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  // Check if department exists
  const department = await queries.getDepartment(env.DB, id);
  if (!department) {
    throw new NotFoundError("Department", id);
  }

  // Check if department has users
  const users = await queries.listUsersByDepartment(env.DB, id);
  if (users.length > 0) {
    throw new ValidationError("Cannot delete department with existing users", {
      user_count: String(users.length),
    });
  }

  await queries.deleteDepartment(env.DB, id);

  return withResponseLogging(
    Response.json({ success: true, message: "Department deleted" }),
    context
  );
}

/**
 * Handles POST /admin/departments/:id/models - Allow/restrict model for department.
 */
export async function setDepartmentModel(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = await request.json() as { model_id: string; is_allowed?: boolean; daily_quota?: number };

  if (!body.model_id) {
    throw new ValidationError("Missing required field: model_id");
  }

  // Verify department exists
  const department = await queries.getDepartment(env.DB, id);
  if (!department) {
    throw new NotFoundError("Department", id);
  }

  // Verify model exists
  const model = await queries.getModel(env.DB, body.model_id);
  if (!model) {
    throw new NotFoundError("Model", body.model_id);
  }

  // Check if permission already exists
  const existing = await queries.getDepartmentModel(env.DB, id, body.model_id);

  if (existing) {
    // Update existing
    await queries.updateDepartmentModel(env.DB, existing.id, {
      is_allowed: body.is_allowed ?? true,
      daily_quota: body.daily_quota ?? 0,
    });
    // Fetch updated record
    const updated = await queries.getDepartmentModel(env.DB, id, body.model_id);
    return withResponseLogging(Response.json(updated), context);
  }

  // Create new permission
  const { generateId } = await import("@/utils/id-generator.js");
  const created = await queries.createDepartmentModel(env.DB, {
    id: generateId(),
    department_id: id,
    model_id: body.model_id,
    is_allowed: body.is_allowed ?? true,
    daily_quota: body.daily_quota ?? 0,
  });

  return withResponseLogging(
    Response.json({ success: true, permission: created }, { status: 201 }),
    context
  );
}

/**
 * Routes admin departments requests.
 */
export function departmentsRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/admin/departments")) {
    return null;
  }

  const parts = pathname.split("/");
  const id = parts[3];

  try {
    if (pathname === "/admin/departments" && request.method === "GET") {
      return listDepartments(request, env, context);
    }

    if (pathname === "/admin/departments" && request.method === "POST") {
      return createDepartment(request, env, context);
    }

    if (!id) {
      return Promise.resolve(
        Response.json({ error: "Invalid path" }, { status: 400 })
      );
    }

    if (parts.length === 4 && request.method === "GET") {
      return getDepartment(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "PUT") {
      return updateDepartment(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "DELETE") {
      return deleteDepartment(request, env, context, id);
    }

    if (parts[4] === "models" && request.method === "POST") {
      return setDepartmentModel(request, env, context, id);
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
