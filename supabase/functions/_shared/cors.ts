/**
 * Shared CORS headers and response helpers.
 * Used by all edge functions.
 */

// Build allowed origins list — includes localhost + optional production domain
const ALLOWED_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

// Add production origin from env if configured
const prodOrigin = Deno.env.get("CORS_ALLOWED_ORIGIN");
if (prodOrigin && !ALLOWED_ORIGINS.includes(prodOrigin)) {
  ALLOWED_ORIGINS.push(prodOrigin);
}

const CORS_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/**
 * Build CORS headers for the given request origin.
 * Returns the origin if it's in the allowlist, otherwise the first allowed origin.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

/** @deprecated Use getCorsHeaders(req.headers.get("Origin")) instead */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...(headers ?? getCorsHeaders()), "Content-Type": "application/json" },
  });
}

export function errorResponse(error: string, message?: string, status = 400, headers?: Record<string, string>) {
  const body: Record<string, unknown> = { error };
  if (message) body.message = message;
  return jsonResponse(body, status, headers);
}
