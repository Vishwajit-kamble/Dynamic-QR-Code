import { createFileRoute } from "@tanstack/react-router";

/**
 * Health-check endpoint (`GET /api/health`) verifying storage backend readiness
 * (`postgres`, `local-file`, or `unconfigured-serverless`) with no-store caching.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const store = await import("@/lib/local-qr-store.server");
        const health = await store.checkStorageHealth();
        return new Response(
          JSON.stringify({
            ...health,
            timestamp: new Date().toISOString(),
          }),
          {
            status: health.ok ? 200 : 503,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store, max-age=0",
            },
          },
        );
      },
    },
  },
});
