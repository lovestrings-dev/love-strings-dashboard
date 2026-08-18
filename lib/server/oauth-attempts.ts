import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import {
  defaultOAuthReturnPath,
  getSafeOAuthReturnPath,
  hashOAuthState,
  integrationKindPattern,
  oauthAttemptLifetimeMs
} from "@/lib/oauth-attempt";
import {
  createServiceSupabaseClient,
  requireAuthenticatedUser,
  type WorkspaceRole
} from "@/lib/server/workspace-owner";

export class OAuthAttemptError extends Error {
  constructor(message = "OAuth authorization session could not be verified.") {
    super(message);
    this.name = "OAuthAttemptError";
  }
}

export async function createOAuthAttempt({
  client = createServiceSupabaseClient(),
  integrationKind,
  origin,
  returnTarget,
  userId,
  workspaceId
}: {
  client?: SupabaseClient;
  integrationKind: string;
  origin: string;
  returnTarget?: string | null;
  userId: string;
  workspaceId: string;
}) {
  if (!integrationKindPattern.test(integrationKind)) {
    throw new OAuthAttemptError("OAuth integration kind is invalid.");
  }

  const state = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + oauthAttemptLifetimeMs).toISOString();
  const returnPath = getSafeOAuthReturnPath(returnTarget, origin);
  const { data, error } = await client
    .from("app_oauth_attempts")
    .insert({
      expires_at: expiresAt,
      integration_kind: integrationKind,
      return_path: returnPath,
      state_hash: hashOAuthState(state),
      user_id: userId,
      workspace_id: workspaceId
    })
    .select("id, expires_at, return_path")
    .single();

  if (error || !data) throw error ?? new Error("OAuth attempt could not be created.");

  return {
    attemptId: data.id as string,
    expiresAt: data.expires_at as string,
    returnPath: data.return_path as string,
    state
  };
}

export async function consumeOAuthAttempt(
  request: NextRequest,
  {
    expectedIntegrationKind,
    requiredWorkspaceRole = "member",
    state
  }: {
    expectedIntegrationKind: string;
    requiredWorkspaceRole?: Extract<WorkspaceRole, "admin" | "member">;
    state: string | null | undefined;
  }
) {
  if (!state || !integrationKindPattern.test(expectedIntegrationKind)) {
    throw new OAuthAttemptError();
  }

  const user = await requireAuthenticatedUser(request);
  const serviceClient = createServiceSupabaseClient();
  const { data, error } = await (serviceClient as any)
    .rpc("consume_app_oauth_attempt", {
      p_integration_kind: expectedIntegrationKind,
      p_required_workspace_role: requiredWorkspaceRole,
      p_state_hash: hashOAuthState(state),
      p_user_id: user.id
    })
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new OAuthAttemptError();

  return {
    attemptId: data.id as string,
    returnPath: data.return_path as string,
    user,
    workspaceId: data.workspace_id as string
  };
}

export const oauthAttemptTesting = {
  defaultReturnPath: defaultOAuthReturnPath,
  oauthAttemptLifetimeMs
};
