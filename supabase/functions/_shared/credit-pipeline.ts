/**
 * Credit pipeline helpers for AI usage tracking and audit logging.
 *
 * Phase 1: Created alongside credit_costs + ai_usage_log tables.
 * Phase 7+: Edge functions migrate from bare .rpc("increment_usage") to
 *           trackAndIncrement() for per-call audit logging.
 *
 * IMPORTANT: All functions swallow errors — usage tracking must NEVER
 * block the AI response. Errors are logged to console.error for
 * edge function log inspection.
 */

import type { SupabaseClient } from "./supabase.ts";

// ============================================================================
// Interfaces
// ============================================================================

export interface CreditLog {
  domain: string;
  action?: string;
  input_mode?: "text" | "voice";
  edge_function: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  session_id?: string;
  restaurant_id?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageResult {
  daily_count: number;
  monthly_count: number;
  daily_limit: number;
  monthly_limit: number;
}

// Safe fallback when usage tracking fails — matches role_policies defaults
const FALLBACK_USAGE: UsageResult = {
  daily_count: 0,
  monthly_count: 0,
  daily_limit: 20,
  monthly_limit: 500,
};

// ============================================================================
// getCreditCost
// ============================================================================

/**
 * Look up the credit cost for a domain + action_type.
 * Resolution order: group-specific override -> system default -> 1 credit.
 *
 * Uses a single query with OR filter (group_id = X OR group_id IS NULL),
 * ordered so group-specific rows sort first (nullsFirst: false).
 * The first row returned is the most specific match.
 */
export async function getCreditCost(
  supabase: SupabaseClient,
  groupId: string,
  domain: string,
  actionType: string = "default",
): Promise<number> {
  try {
    const { data } = await supabase
      .from("credit_costs")
      .select("credits")
      .or(`group_id.eq.${groupId},group_id.is.null`)
      .eq("domain", domain)
      .eq("action_type", actionType)
      .eq("is_active", true)
      .order("group_id", { ascending: false, nullsFirst: false })
      .limit(1);

    return data?.[0]?.credits ?? 1;
  } catch (err) {
    console.error("[credit-pipeline] getCreditCost error:", err);
    return 1; // safe fallback
  }
}

// ============================================================================
// trackAndIncrement
// ============================================================================

/**
 * Increment usage counters with audit logging.
 * Drop-in enhancement for bare `supabase.rpc("increment_usage", { _user_id, _group_id })`.
 *
 * Calls the updated `increment_usage()` PG function with all 4 params:
 *   _user_id, _group_id, _credits, _log (JSONB audit payload)
 *
 * Returns all 4 fields (counts + limits) matching the PG function's return type.
 * Swallows all errors — usage tracking should never block the AI response.
 *
 * @param supabase - Service-role client (edge functions always use service role)
 * @param userId  - Authenticated user's UUID, or null for system-initiated calls
 * @param groupId - Group UUID
 * @param credits - Number of credits to consume (from getCreditCost)
 * @param log     - Audit payload written to ai_usage_log
 */
export async function trackAndIncrement(
  supabase: SupabaseClient,
  userId: string | null,
  groupId: string,
  credits: number,
  log: CreditLog,
): Promise<UsageResult> {
  try {
    const { data, error } = await supabase.rpc("increment_usage", {
      _user_id: userId,
      _group_id: groupId,
      _credits: credits,
      _log: log,
    });

    if (error) {
      console.error("[credit-pipeline] increment_usage RPC error:", error.message);
      return { ...FALLBACK_USAGE };
    }

    return data?.[0] ?? { ...FALLBACK_USAGE };
  } catch (err) {
    console.error("[credit-pipeline] trackAndIncrement unexpected error:", err);
    return { ...FALLBACK_USAGE };
  }
}
