/**
 * Users Management API
 *
 * Admin endpoints for managing users.
 *
 * @module api/admin/users
 */

import type {
  Env,
  RequestContext,
} from "@agate/shared/types";
import type { CreateUserDto, UpdateUserDto } from "@agate/shared/db/queries.js";
import * as queries from "@agate/shared/db/queries.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ApiError,
} from "@agate/shared/utils/errors/index.js";
import { withResponseLogging, logError } from "@agate/shared/middleware/logger.js";

/**
 * System user IDs that cannot be modified or deleted.
 */
const SYSTEM_USER_IDS = ["sys-health-user"];

/**
 * Checks if a user ID is a system user.
 */
function isSystemUser(userId: string): boolean {
  return SYSTEM_USER_IDS.includes(userId);
}

/**
 * Handles GET /admin/users - List users.
 */
export async function listUsers(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("company_id");
  const departmentId = url.searchParams.get("department_id");
  const role = url.searchParams.get("role");
  const isActive = url.searchParams.get("is_active");
  const search = url.searchParams.get("search");
  const pageStr = url.searchParams.get("page");
  const pageSizeStr = url.searchParams.get("page_size");

  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;

  let users;
  if (companyId) {
    users = await queries.listUsersByCompany(env.DB, companyId);
  } else if (departmentId) {
    users = await queries.listUsersByDepartment(env.DB, departmentId);
  } else {
    users = await queries.listAllUsers(env.DB);
  }

  // Apply filters
  let filteredUsers = users;
  if (role) {
    filteredUsers = filteredUsers.filter((u: any) => u.role === role);
  }
  if (isActive && isActive !== 'null' && isActive !== '') {
    const activeBool = isActive === 'true';
    filteredUsers = filteredUsers.filter((u: any) => Boolean(u.is_active) === activeBool);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    filteredUsers = filteredUsers.filter((u: any) =>
      (u.email && u.email.toLowerCase().includes(searchLower)) ||
      (u.name && u.name.toLowerCase().includes(searchLower))
    );
  }

  // Add is_system flag for system users
  const usersWithSystemFlag = filteredUsers.map((user: any) => ({
    ...user,
    is_system: isSystemUser(user.id),
  }));

  // Apply pagination
  const total = usersWithSystemFlag.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedUsers = usersWithSystemFlag.slice(startIndex, endIndex);

  return withResponseLogging(
    Response.json({
      users: paginatedUsers,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    }),
    context
  );
}

/**
 * Handles POST /admin/users - Create new user.
 *
 * PRD V2 第一期设计：
 * - 简化用户系统，仅支持 API Key 认证
 * - 不强制要求 company_id/department_id（组织架构留待第二期）
 * - 支持创建系统用户用于健康检查
 */
export async function createUser(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const body = await request.json() as {
    id?: string;
    email: string;
    name?: string;
    company_id?: string;
    department_id?: string;
    role?: string;
    quota_daily?: number;
  };

  // Validate required fields
  if (!body.email) {
    throw new ValidationError("Missing required field: email");
  }

  // Generate ID if not provided
  const data: CreateUserDto = {
    id: body.id || `u_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    email: body.email,
    name: body.name,
    company_id: body.company_id,  // Optional in V2 Phase 1
    department_id: body.department_id,
    role: body.role,
    quota_daily: body.quota_daily ?? 0,
  };

  // Check for duplicate email
  const existingByEmail = await queries.getUserByEmail(env.DB, data.email);
  if (existingByEmail) {
    throw new ConflictError("User", "email", data.email);
  }

  // Verify company exists if provided (for future V2 Phase 2)
  if (data.company_id) {
    const company = await queries.getCompany(env.DB, data.company_id);
    if (!company) {
      throw new NotFoundError("Company", data.company_id);
    }
  }

  // Verify department exists if provided
  if (data.department_id) {
    const department = await queries.getDepartment(env.DB, data.department_id);
    if (!department) {
      throw new NotFoundError("Department", data.department_id);
    }
  }

  const user = await queries.createUser(env.DB, data);

  return withResponseLogging(
    Response.json(user, { status: 201 }),
    context
  );
}

/**
 * Handles GET /admin/users/:id - Get user details.
 */
export async function getUser(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const user = await queries.getUser(env.DB, id);

  if (!user) {
    throw new NotFoundError("User", id);
  }

  // Add is_system flag for system users
  const userWithSystemFlag = {
    ...user,
    is_system: isSystemUser(id),
  };

  return withResponseLogging(Response.json(userWithSystemFlag), context);
}

/**
 * Handles PUT /admin/users/:id - Update user.
 */
export async function updateUser(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  // Prevent modification of system users
  if (isSystemUser(id)) {
    throw new ValidationError("System users cannot be modified");
  }

  const body = await request.json() as UpdateUserDto;
  const user = await queries.updateUser(env.DB, id, body);

  return withResponseLogging(Response.json(user), context);
}

/**
 * Handles DELETE /admin/users/:id - Delete user.
 */
export async function deleteUser(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  // Prevent deletion of system users
  if (isSystemUser(id)) {
    throw new ValidationError("System users cannot be deleted");
  }

  // Check if user exists
  const user = await queries.getUser(env.DB, id);
  if (!user) {
    throw new NotFoundError("User", id);
  }

  // Check if user has API keys
  const apiKeys = await queries.listApiKeys(env.DB, { user_id: id });
  if (apiKeys.length > 0) {
    throw new ValidationError("Cannot delete user with existing API keys", {
      api_key_count: String(apiKeys.length),
    });
  }

  await queries.deleteUser(env.DB, id);

  return withResponseLogging(
    Response.json({ success: true, message: "User deleted" }),
    context
  );
}

/**
 * Routes admin users requests.
 */
export function usersRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/admin/users")) {
    return null;
  }

  const parts = pathname.split("/");
  const id = parts[3];

  try {
    if (pathname === "/admin/users" && request.method === "GET") {
      return listUsers(request, env, context);
    }

    if (pathname === "/admin/users" && request.method === "POST") {
      return createUser(request, env, context);
    }

    if (!id) {
      return Promise.resolve(
        Response.json({ error: "Invalid path" }, { status: 400 })
      );
    }

    if (parts.length === 4 && request.method === "GET") {
      return getUser(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "PUT") {
      return updateUser(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "DELETE") {
      return deleteUser(request, env, context, id);
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
