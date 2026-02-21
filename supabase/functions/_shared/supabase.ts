/**
 * Shared Supabase client factory helpers.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Create an anon-level client scoped to the caller's auth header. */
export function createAnonClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

/** Create a service-role client (bypasses RLS). */
export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export type SupabaseClient = ReturnType<typeof createClient>;
