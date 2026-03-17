/**
 * Admin Auth API Handler
 *
 * Provides authentication verification for Dashboard login.
 *
 * Endpoints:
 * - GET /admin/auth - Verify API key and return user info
 */

import type { RequestContext } from "@/types/index.js";
import type { AuthContext } from "@/types/index.js";
import { UnauthorizedError } from "@/utils/errors/index.js";

/**
 * Handles GET /admin/auth - Verify API key and return auth context
 *
 * @param request - Incoming request
 * @param context - Request context with auth data
 * @returns Response with auth context or error
 */
export async function authRouteHandler(
  request: Request,
  _env: unknown,
  context: RequestContext,
): Promise<Response | null> {
  const url = new URL(request.url);

  // GET /admin/auth - Verify API key and return user info
  if (url.pathname === "/admin/auth" && request.method === "GET") {
    // Auth context is attached by auth middleware
    const auth = context.metadata.get("auth") as AuthContext | undefined;

    if (!auth) {
      throw new UnauthorizedError("Invalid API key");
    }

    return Response.json({
      apiKeyId: auth.apiKeyId,
      userId: auth.userId,
      userEmail: auth.userEmail,
      userName: auth.userName,
      userRole: auth.userRole,
      companyId: auth.companyId,
      companyName: auth.companyName,
      departmentId: auth.departmentId,
      departmentName: auth.departmentName,
      quotaDaily: auth.quotaDaily,
      quotaUsed: auth.quotaUsed,
      quotaBonus: auth.quotaBonus,
      quotaBonusExpiry: auth.quotaBonusExpiry,
      isUnlimited: auth.isUnlimited,
      isActive: auth.isActive,
      expiresAt: auth.expiresAt,
    } satisfies AuthContext);
  }

  return null;
}
