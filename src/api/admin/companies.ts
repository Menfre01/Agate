/**
 * Companies Management API
 *
 * Admin endpoints for managing companies.
 *
 * @module api/admin/companies
 */

import type {
  Env,
  RequestContext,
} from "@/types/index.js";
import type { CreateCompanyDto, UpdateCompanyDto } from "@/db/queries.js";
import * as queries from "@/db/queries.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ApiError,
} from "@/utils/errors/index.js";
import { withResponseLogging, logError } from "@/middleware/logger.js";

/**
 * Handles GET /admin/companies - List all companies.
 */
export async function listCompanies(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const companies = await queries.listCompanies(env.DB);

  return withResponseLogging(
    Response.json({ companies }),
    context
  );
}

/**
 * Handles POST /admin/companies - Create new company.
 */
export async function createCompany(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const body = await request.json() as { id?: string; name: string; quota_pool?: number; quota_daily?: number };

  // Generate ID if not provided
  const data: CreateCompanyDto = {
    id: body.id || `co_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    name: body.name,
    quota_pool: body.quota_pool ?? 0,
    quota_daily: body.quota_daily ?? 0,
  };

  if (!data.name) {
    throw new ValidationError("Missing required field: name");
  }

  // Check for duplicate company name
  const companies = await queries.listCompanies(env.DB);
  const existing = companies.find((c) => c.name === data.name);
  if (existing) {
    throw new ConflictError("Company", "name", data.name);
  }

  const company = await queries.createCompany(env.DB, data);

  return withResponseLogging(
    Response.json(company, { status: 201 }),
    context
  );
}

/**
 * Handles GET /admin/companies/:id - Get company details.
 */
export async function getCompany(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const company = await queries.getCompany(env.DB, id);

  if (!company) {
    throw new NotFoundError("Company", id);
  }

  return withResponseLogging(Response.json(company), context);
}

/**
 * Handles PUT /admin/companies/:id - Update company.
 */
export async function updateCompany(
  request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  const body = await request.json() as UpdateCompanyDto;
  const company = await queries.updateCompany(env.DB, id, body);

  return withResponseLogging(Response.json(company), context);
}

/**
 * Handles DELETE /admin/companies/:id - Delete company.
 */
export async function deleteCompany(
  _request: Request,
  env: Env,
  context: RequestContext,
  id: string
): Promise<Response> {
  await queries.deleteCompany(env.DB, id);

  return withResponseLogging(
    Response.json({ success: true, message: "Company deleted" }),
    context
  );
}

/**
 * Routes admin companies requests.
 */
export function companiesRouteHandler(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/admin/companies")) {
    return null;
  }

  const parts = pathname.split("/");
  const id = parts[3];

  try {
    if (pathname === "/admin/companies" && request.method === "GET") {
      return listCompanies(request, env, context);
    }

    if (pathname === "/admin/companies" && request.method === "POST") {
      return createCompany(request, env, context);
    }

    if (!id) {
      return Promise.resolve(
        Response.json({ error: "Invalid path" }, { status: 400 })
      );
    }

    if (parts.length === 4 && request.method === "GET") {
      return getCompany(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "PUT") {
      return updateCompany(request, env, context, id);
    }

    if (parts.length === 4 && request.method === "DELETE") {
      return deleteCompany(request, env, context, id);
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
