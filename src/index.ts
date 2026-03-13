/**
 * AI Gateway - Main Entry Point
 *
 * A Cloudflare Worker-based gateway for proxying AI API requests
 * with multi-tenant management, quota control, and usage tracking.
 */

export interface Env {
  // D1 Database binding
  DB: D1Database;

  // KV Cache binding for API key authentication caching
  KV_CACHE: KVNamespace;

  // Environment configuration
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Health check endpoint
      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          timestamp: Date.now(),
          environment: env.ENVIRONMENT,
        });
      }

      // 404 for unimplemented routes
      return Response.json(
        {
          error: "Not Found",
          message: "The requested endpoint is not yet implemented",
          path: url.pathname,
        },
        { status: 404 }
      );
    } catch (error) {
      return Response.json(
        {
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  },
} satisfies ExportedHandler<Env>;
