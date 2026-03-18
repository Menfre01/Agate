/**
 * User Auth API Handler
 *
 * Provides authentication for normal users (not just admins).
 *
 * Endpoints:
 * - GET /user/auth - Verify API key and return user info
 */

import type { RequestContext } from "@/types/index.js";
import type { AuthContext } from "@/types/index.js";
import { UnauthorizedError } from "@/utils/errors/index.js";

/**
 * Handles GET /user/auth - Verify API key and return user info
 *
 * Similar to /admin/auth but doesn't require admin role.
 *
 * @param request - Incoming request
 * @param context - Request context with auth data
 * @returns Response with auth context or error
 */
export async function userAuthRouteHandler(
  request: Request,
  _env: unknown,
  context: RequestContext,
): Promise<Response | null> {
  const url = new URL(request.url);

  // GET /user/auth - 普通用户也可访问
  if (url.pathname === "/user/auth" && request.method === "GET") {
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
