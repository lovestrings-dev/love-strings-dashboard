import type { SupabaseClient } from "@supabase/supabase-js";

const productionAppUrl = "https://love-strings-dashboard.vercel.app";

/**
 * Delivers the established ordinary workspace-invitation handoff. New
 * recipients receive the password-setup invitation; existing recipients get
 * a magic link that carries the same invitation token.
 */
export async function sendWorkspaceInvitationEmail(
  serviceClient: SupabaseClient,
  email: string,
  token: string
) {
  const passwordSetupUrl = `${getPublicAppUrl()}/set-password?workspace_invitation=${token}`;
  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: passwordSetupUrl
  });
  if (!error && data.user) return "new_user" as const;

  const message = error?.message.toLowerCase() ?? "";
  if (message.includes("already") || message.includes("registered")) {
    const { error: magicLinkError } = await serviceClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${passwordSetupUrl}&workspace_join=1` }
    });
    if (!magicLinkError) return "existing_user" as const;
    throw magicLinkError;
  }

  throw error ?? new Error("Supabase did not return the invited user.");
}

function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configuredUrl || productionAppUrl).replace(/\/$/, "");
}
