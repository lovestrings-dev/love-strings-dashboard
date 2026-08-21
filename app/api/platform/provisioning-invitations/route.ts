import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformOwner, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const productionAppUrl = "https://love-strings-dashboard.vercel.app";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const { serviceClient } = await requirePlatformOwner(request);
    const { data, error } = await serviceClient
      .from("app_workspace_provisioning_invitations")
      .select("id, email, created_at, expires_at, accepted_at, revoked_at, provisioned_workspace_id")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const workspaceIds = (data ?? []).flatMap((invite) => invite.provisioned_workspace_id ? [invite.provisioned_workspace_id] : []);
    const { data: workspaces, error: workspaceError } = workspaceIds.length
      ? await serviceClient.from("app_workspaces").select("id, name").in("id", workspaceIds)
      : { data: [], error: null };
    if (workspaceError) throw workspaceError;
    const names = new Map((workspaces ?? []).map((workspace) => [workspace.id, workspace.name]));
    return NextResponse.json({ invitations: (data ?? []).map((invite) => ({
      acceptedAt: invite.accepted_at,
      createdAt: invite.created_at,
      email: invite.email,
      expiresAt: invite.expires_at,
      id: invite.id,
      status: invitationStatus(invite),
      workspaceName: invite.provisioned_workspace_id ? names.get(invite.provisioned_workspace_id) ?? null : null
    })) });
  } catch (error) { return errorResponse(error, "Provisioning invitations could not be loaded."); }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  try {
    const { serviceClient, user } = await requirePlatformOwner(request);
    const payload = await request.json() as { email?: string };
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid administrator email address." }, { status: 400 });
    const { data: duplicate, error: duplicateError } = await serviceClient
      .from("app_workspace_provisioning_invitations")
      .select("id, expires_at")
      .eq("email", email).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate && new Date(duplicate.expires_at).getTime() > Date.now()) {
      return NextResponse.json({ error: "This email already has a pending provisioning invitation." }, { status: 409 });
    }
    const token = invitationToken();
    const { data: invitation, error } = await serviceClient
      .from("app_workspace_provisioning_invitations")
      .insert({ created_by: user.id, email, token_hash: hashToken(token) }).select("id").single();
    if (error) throw error;
    try { await sendProvisioningEmail(serviceClient, email, token); }
    catch (sendError) { await serviceClient.from("app_workspace_provisioning_invitations").delete().eq("id", invitation.id); throw sendError; }
    return NextResponse.json({ email, status: "sent" });
  } catch (error) { return errorResponse(error, "Provisioning invitation could not be sent."); }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  try {
    const { serviceClient } = await requirePlatformOwner(request);
    const payload = await request.json() as { action?: "resend"; invitationId?: string };
    if (payload.action !== "resend" || !isUuid(payload.invitationId)) return NextResponse.json({ error: "Choose a valid pending invitation." }, { status: 400 });
    const invitation = await pendingInvitation(serviceClient, payload.invitationId);
    if (!invitation) return NextResponse.json({ error: "This invitation cannot be resent." }, { status: 404 });
    const token = invitationToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: updated, error } = await serviceClient.from("app_workspace_provisioning_invitations")
      .update({ expires_at: expiresAt, token_hash: hashToken(token) }).eq("id", invitation.id).eq("token_hash", invitation.token_hash)
      .is("accepted_at", null).is("revoked_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ error: "This invitation is no longer pending." }, { status: 409 });
    try { await sendProvisioningEmail(serviceClient, invitation.email, token); }
    catch (sendError) { await serviceClient.from("app_workspace_provisioning_invitations").update({ expires_at: invitation.expires_at, token_hash: invitation.token_hash }).eq("id", invitation.id).eq("token_hash", hashToken(token)); throw sendError; }
    return NextResponse.json({ id: invitation.id, status: "resent" });
  } catch (error) { return errorResponse(error, "Provisioning invitation could not be resent."); }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  try {
    const { serviceClient, user } = await requirePlatformOwner(request);
    const payload = await request.json() as { invitationId?: string };
    if (!isUuid(payload.invitationId)) return NextResponse.json({ error: "Choose a valid invitation." }, { status: 400 });
    const { data, error } = await serviceClient.from("app_workspace_provisioning_invitations")
      .update({ revoked_at: new Date().toISOString(), revoked_by: user.id }).eq("id", payload.invitationId).is("accepted_at", null).is("revoked_at", null)
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "This invitation can no longer be revoked." }, { status: 409 });
    return NextResponse.json({ id: data.id, status: "revoked" });
  } catch (error) { return errorResponse(error, "Provisioning invitation could not be revoked."); }
}

async function pendingInvitation(service: Awaited<ReturnType<typeof requirePlatformOwner>>["serviceClient"], id: string) {
  const { data, error } = await service.from("app_workspace_provisioning_invitations").select("id, email, token_hash, expires_at")
    .eq("id", id).is("accepted_at", null).is("revoked_at", null).maybeSingle();
  if (error) throw error; return data;
}
async function sendProvisioningEmail(service: Awaited<ReturnType<typeof requirePlatformOwner>>["serviceClient"], email: string, token: string) {
  const setupUrl = `${publicUrl()}/set-password?provisioning_invitation=${encodeURIComponent(token)}`;
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo: setupUrl });
  if (!error && data.user) return;
  const message = error?.message.toLowerCase() ?? "";
  if (message.includes("already") || message.includes("registered")) {
    const { error: magicError } = await service.auth.signInWithOtp({ email, options: { emailRedirectTo: `${setupUrl}&provisioning_join=1` } });
    if (!magicError) return; throw magicError;
  }
  throw error ?? new Error("Supabase did not return the invited user.");
}
function invitationStatus(invite: { accepted_at: string | null; expires_at: string; revoked_at: string | null }) { if (invite.revoked_at) return "revoked"; if (invite.accepted_at) return "accepted"; return new Date(invite.expires_at).getTime() <= Date.now() ? "expired" : "pending"; }
function invitationToken() { return randomBytes(32).toString("base64url"); }
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function publicUrl() { return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || productionAppUrl).replace(/\/$/, ""); }
function isUuid(value?: string): value is string { return Boolean(value && uuidPattern.test(value)); }
function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function isSameOriginRequest(request: NextRequest) { const origin = request.headers.get("origin"), host = request.headers.get("host"); if (!origin || !host) return false; try { return new URL(origin).host === host; } catch { return false; } }
function errorResponse(error: unknown, fallback: string) { const status = error instanceof WorkspaceAccessError ? error.status : 500; return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status }); }
