import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  activeWorkspaceCookieName,
  parseWorkspaceId
} from "@/lib/workspace";
import {
  createServiceSupabaseClient,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { token?: string };
    if (!payload.token || payload.token.length < 32) {
      return NextResponse.json({ error: "Invalid workspace invitation." }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      throw new WorkspaceAccessError("Sign in again to accept this invitation.", 401);
    }

    const serviceClient = createServiceSupabaseClient();
    const tokenHash = createHash("sha256").update(payload.token).digest("hex");
    const { data: invitation, error } = await serviceClient
      .from("app_workspace_invitations")
      .select("id, workspace_id, email, role, expires_at, accepted_at, accepted_by, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw error;
    if (!invitation || invitation.email !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "This invitation is not valid for this account." }, { status: 403 });
    }
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "This workspace invitation has expired." }, { status: 410 });
    }
    if (invitation.revoked_at) {
      return NextResponse.json({ error: "This workspace invitation has been revoked." }, { status: 410 });
    }
    if (invitation.accepted_by && invitation.accepted_by !== user.id) {
      return NextResponse.json({ error: "This invitation has already been accepted." }, { status: 409 });
    }

    if (!invitation.accepted_at) {
      const { data: acceptedInvitation, error: acceptanceError } = await serviceClient
        .from("app_workspace_invitations")
        .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
        .eq("id", invitation.id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();
      if (acceptanceError) throw acceptanceError;
      if (!acceptedInvitation) {
        return NextResponse.json({ error: "This workspace invitation is no longer pending." }, { status: 409 });
      }
    }

    const { error: membershipError } = await serviceClient
      .from("app_workspace_members")
      .upsert(
        { workspace_id: invitation.workspace_id, user_id: user.id, role: invitation.role },
        { onConflict: "workspace_id,user_id", ignoreDuplicates: true }
      );
    if (membershipError) throw membershipError;

    const { error: preferencesError } = await serviceClient
      .from("dashboard_preferences")
      .upsert(
        { workspace_id: invitation.workspace_id, user_id: user.id },
        { onConflict: "workspace_id,user_id", ignoreDuplicates: true }
      );
    if (preferencesError) throw preferencesError;

    const response = NextResponse.json({ status: "accepted", workspaceId: invitation.workspace_id });
    response.cookies.set(activeWorkspaceCookieName, parseWorkspaceId(invitation.workspace_id)!, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:"
    });
    return response;
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invitation acceptance failed." },
      { status }
    );
  }
}

async function getAuthenticatedUser(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase authentication is not configured.");
  }
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined }
  });
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const {
    data: { user },
    error
  } = await client.auth.getUser(bearerToken);
  return error ? null : user;
}
