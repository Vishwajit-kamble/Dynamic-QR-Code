import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  pragma: "no-cache",
  expires: "0",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStatusHtml(title: string, message: string, cardCode?: string): string {
  const safeCode = cardCode ? escapeHtml(cardCode) : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 20px; }
      main { max-width: 420px; width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px 24px; text-align: center; box-shadow: 0 2px 10px rgba(15,23,42,0.04); }
      h1 { margin: 0 0 10px; font-size: 20px; font-weight: 600; }
      p { margin: 0; color: #475569; font-size: 14px; line-height: 1.55; }
      .code { margin-top: 16px; display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #334155; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${safeCode ? `<div class="code">Card ID: ${safeCode}</div>` : ""}
    </main>
  </body>
</html>`;
}

export const Route = createFileRoute("/r/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const userAgent = request.headers.get("user-agent") ?? "";
        const deviceType = /ipad|tablet/i.test(userAgent)
          ? "tablet"
          : /mobile|android|iphone|ipod/i.test(userAgent)
            ? "mobile"
            : "desktop";
        const referrer = request.headers.get("referer");
        let referrerHost: string | null = null;
        if (referrer) {
          try {
            referrerHost = new URL(referrer).hostname;
          } catch {
            referrerHost = null;
          }
        }

        try {
          const store = await import("@/lib/local-qr-store.server");
          const resolved = await store.resolveLocalQrScanDetailed(
            params.code,
            deviceType,
            referrerHost,
          );

          if (resolved.status === "redirect") {
            return new Response(null, {
              status: 302,
              headers: {
                ...NO_CACHE_HEADERS,
                location: resolved.destinationUrl,
                "referrer-policy": "no-referrer",
              },
            });
          }

          if (resolved.status === "paused") {
            return new Response(
              renderStatusHtml(
                "This QR card is not active yet",
                "This card is currently paused or waiting to be linked to a business page. Please ask the owner to activate it in QR Studio.",
                resolved.code,
              ),
              {
                status: 404,
                headers: {
                  ...NO_CACHE_HEADERS,
                  "content-type": "text/html; charset=utf-8",
                },
              },
            );
          }

          const url = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
          if (url && key && store.getStorageMode() === "unconfigured-serverless") {
            const supabase = createClient<Database>(url, key, {
              auth: {
                storage: undefined,
                persistSession: false,
                autoRefreshToken: false,
              },
              global: {
                fetch: (input, init) => {
                  const headers = new Headers(
                    typeof Request !== "undefined" && input instanceof Request
                      ? input.headers
                      : undefined,
                  );
                  if (init?.headers)
                    new Headers(init.headers).forEach((value, name) => headers.set(name, value));
                  if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
                    headers.delete("Authorization");
                  }
                  headers.set("apikey", key);
                  return fetch(input, { ...init, headers });
                },
              },
            });

            const { data, error } = await supabase.rpc("resolve_qr_scan", {
              p_code: params.code,
              p_device_type: deviceType,
              p_referrer_host: referrerHost ?? "",
            });
            const destination = data?.[0]?.destination_url;
            if (!error && destination) {
              return new Response(null, {
                status: 302,
                headers: {
                  ...NO_CACHE_HEADERS,
                  location: destination,
                  "referrer-policy": "no-referrer",
                },
              });
            }
          }

          return new Response(
            renderStatusHtml(
              "QR code unavailable",
              "This QR code link could not be found or is no longer active.",
              params.code,
            ),
            {
              status: 404,
              headers: {
                ...NO_CACHE_HEADERS,
                "content-type": "text/html; charset=utf-8",
              },
            },
          );
        } catch (err) {
          console.error("[QR Redirect Error]", err);
          return new Response(
            renderStatusHtml(
              "Temporarily unable to open link",
              "Please wait a moment and scan this QR code again.",
            ),
            {
              status: 503,
              headers: {
                ...NO_CACHE_HEADERS,
                "content-type": "text/html; charset=utf-8",
              },
            },
          );
        }
      },
    },
  },
});
