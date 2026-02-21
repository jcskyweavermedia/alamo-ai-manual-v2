/**
 * Shared authentication helpers.
 *
 * Two methods:
 * - authenticateWithClaims(): fast, no network — use for read-only operations
 * - authenticateWithUser(): validates token not revoked — use for write operations
 */

import { createAnonClient, createServiceClient, type SupabaseClient } from "./supabase.ts";

export interface AuthResult {
  userId: string;
  supabase: SupabaseClient;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function extractAuthHeader(req: Request): string {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing authorization header");
  }
  return authHeader;
}

/**
 * Authenticate via getClaims() — fast, no network round-trip.
 * Use for read-only operations (content loading, tutor chat).
 */
export async function authenticateWithClaims(req: Request): Promise<AuthResult> {
  const authHeader = extractAuthHeader(req);
  const supabaseAuth = createAnonClient(authHeader);
  const token = authHeader.replace("Bearer ", "");

  const { data, error } = await supabaseAuth.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new AuthError("Invalid token");
  }

  return {
    userId: data.claims.sub as string,
    supabase: createServiceClient(),
  };
}

/**
 * Authenticate via getUser() — validates token is not revoked.
 * Use for write operations (assessments, evaluations, quiz generation).
 */
export async function authenticateWithUser(req: Request): Promise<AuthResult> {
  const authHeader = extractAuthHeader(req);
  const supabaseAuth = createAnonClient(authHeader);
  const token = authHeader.replace("Bearer ", "");

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError("Invalid token");
  }

  return {
    userId: data.user.id,
    supabase: createServiceClient(),
  };
}
