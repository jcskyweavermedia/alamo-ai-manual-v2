/**
 * Shared AI usage quota helpers.
 */

import type { SupabaseClient } from "./supabase.ts";

export interface UsageInfo {
  can_ask: boolean;
  daily_count: number;
  daily_limit: number;
  monthly_count: number;
  monthly_limit: number;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

/**
 * Check if user has remaining AI usage quota.
 * Returns usage info, or null if the user is not a member of the group.
 * Throws UsageError if the RPC call itself fails (network/DB error).
 */
export async function checkUsage(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<UsageInfo | null> {
  const { data, error } = await supabase.rpc("get_user_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  if (error) {
    console.error("[usage] Check error:", error.message);
    throw new UsageError("Failed to check usage limits");
  }

  return (data?.[0] as UsageInfo) || null;
}

/**
 * Increment user's AI usage counter (call after a successful AI call).
 */
export async function incrementUsage(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<void> {
  await supabase.rpc("increment_usage", {
    _user_id: userId,
    _group_id: groupId,
  });
}
