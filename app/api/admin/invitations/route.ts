import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import {
  requireWorkspaceAdministrator,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

type WorkspaceRole = "admin" | "member" | "viewer";

const productionAppUrl = "https://love-strings-dashboard.vercel.app";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { data, error } = await serviceClient
      .from("app_workspace_invitations")
      .select("id, email, role, created_at, expires_at, accepted_at, revoked_at, created_by")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const invitations = await Promise.all(
      (data ?? []).map(async (invitation) => {
        const { data: invitedBy } = await serviceClient.auth.admin.getUserById(invitation.created_by);
        return {
          createdAt: invitation.created_at,
          email: invitation.email,
          expiresAt: invitation.expires_at,
          id: invitation.id,
          invitedBy: invitedBy.user?.email ?? "Workspace Admin",
          role: invitation.role as WorkspaceRole,
          status: getInvitationStatus(invitation)
        };
      })
    );

    return NextResponse.json({ invitations });
  } catch (error) {
    return errorResponse(error, "Invitations could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { serviceClient, user: inviter, workspaceId } = await requireWorkspaceAdministrator(request);
    const payload = (await request.json()) as { email?: string; role?: string };
    const email = payload.email?.trim().toLowerCase() ?? "";
    const role = normalizeRole(payload.role);

    if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!role) return NextResponse.json({ error: "Choose a valid workspace role." }, { status: 400 });

    const token = createInvitationToken();
    const { data: invitation, error: invitationError } = await serviceClient
      .from("app_workspace_invitations")
      .insert({
        created_by: inviter.id,
        email,
        role,
        token_hash: hashInvitationToken(token),
        workspace_id: workspaceId
      })
      .select("id")
      .single();
    if (invitationError) {
      if (invitationError.code === "23505") {
        return NextResponse.json(
          { error: "This email already has a pending invitation to this workspace." },
          { status: 409 }
        );
      }
      throw invitationError;
    }

    try {
      await sendInvitationEmail(serviceClient, email, token);
    } catch (error) {
      await serviceClient.from("app_workspace_invitations").delete().eq("id", invitation.id);
      throw error;
    }

    return NextResponse.json({ email, role, status: "sent" });
  } catch (error) {
    return errorResponse(error, "Invitation could not be sent.");
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const payload = (await request.json()) as {
      action?: "resend" | "role";
      invitationId?: string;
      role?: string;
    };
    if (!isUuid(payload.invitationId)) {
      return NextResponse.json({ error: "Choose a valid invitation." }, { status: 400 });
    }

    const invitation = await getPendingInvitation(serviceClient, workspaceId, payload.invitationId);
    if (!invitation) {
      return NextResponse.json({ error: "Pending invitation was not found." }, { status: 404 });
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Expired invitations cannot be changed or resent." }, { status: 410 });
    }

    if (payload.action === "role") {
      const role = normalizeRole(payload.role);
      if (!role) return NextResponse.json({ error: "Choose a valid workspace role." }, { status: 400 });
      const { error } = await serviceClient
        .from("app_workspace_invitations")
        .update({ role })
        .eq("id", invitation.id)
        .eq("workspace_id", workspaceId)
        .is("accepted_at", null)
        .is("revoked_at", null);
      if (error) throw error;
      return NextResponse.json({ id: invitation.id, role, status: "updated" });
    }

    if (payload.action !== "resend") {
      return NextResponse.json({ error: "Choose a valid invitation action." }, { status: 400 });
    }

    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rotated, error: rotationError } = await serviceClient
      .from("app_workspace_invitations")
      .update({ expires_at: expiresAt, token_hash: tokenHash })
      .eq("id", invitation.id)
      .eq("workspace_id", workspaceId)
      .eq("token_hash", invitation.token_hash)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (rotationError) throw rotationError;
    if (!rotated) return NextResponse.json({ error: "Invitation is no longer pending." }, { status: 409 });

    try {
      await sendInvitationEmail(serviceClient, invitation.email, token);
    } catch (error) {
      await serviceClient
        .from("app_workspace_invitations")
        .update({ expires_at: invitation.expires_at, token_hash: invitation.token_hash })
        .eq("id", invitation.id)
        .eq("workspace_id", workspaceId)
        .eq("token_hash", tokenHash);
      throw error;
    }

    return NextResponse.json({ id: invitation.id, role: invitation.role, status: "resent" });
  } catch (error) {
    return errorResponse(error, "Invitation could not be updated.");
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    const payload = (await request.json()) as { invitationId?: string };
    if (!isUuid(payload.invitationId)) {
      return NextResponse.json({ error: "Choose a valid invitation." }, { status: 400 });
    }
    const invitation = await getPendingInvitation(serviceClient, workspaceId, payload.invitationId);
    if (!invitation) return NextResponse.json({ error: "Pending invitation was not found." }, { status: 404 });
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Expired invitations cannot be revoked." }, { status: 410 });
    }

    const { data, error } = await serviceClient
      .from("app_workspace_invitations")
      .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
      .eq("id", invitation.id)
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Invitation is no longer pending." }, { status: 409 });

    return NextResponse.json({ id: invitation.id, status: "revoked" });
  } catch (error) {
    return errorResponse(error, "Invitation could not be revoked.");
  }
}

async function getPendingInvitation(
  serviceClient: Awaited<ReturnType<typeof requireWorkspaceAdministrator>>["serviceClient"],
  workspaceId: string,
  invitationId: string
) {
  const { data, error } = await serviceClient
    .from("app_workspace_invitations")
    .select("id, email, role, token_hash, expires_at")
    .eq("id", invitationId)
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function sendInvitationEmail(
  serviceClient: Awaited<ReturnType<typeof requireWorkspaceAdministrator>>["serviceClient"],
  email: string,
  token: string
) {
  const passwordSetupUrl = `${getPublicAppUrl()}/set-password?workspace_invitation=${token}`;
  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: passwordSetupUrl
  });
  if (!error && data.user) return;

  const message = error?.message.toLowerCase() ?? "";
  if (message.includes("already") || message.includes("registered")) {
    const { error: magicLinkError } = await serviceClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${passwordSetupUrl}&workspace_join=1` }
    });
    if (!magicLinkError) return;
    throw magicLinkError;
  }

  throw error ?? new Error("Supabase did not return the invited user.");
}

function getInvitationStatus(invitation: { accepted_at: string | null; expires_at: string; revoked_at: string | null }) {
  if (invitation.revoked_at) return "revoked";
  if (invitation.accepted_at) return "accepted";
  return new Date(invitation.expires_at).getTime() <= Date.now() ? "expired" : "pending";
}

function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configuredUrl || productionAppUrl).replace(/\/$/, "");
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!host) return false;
  if (fetchSite === "same-origin") return true;
  if (!origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function normalizeRole(value?: string): WorkspaceRole | null {
  return value === "admin" || value === "member" || value === "viewer" ? value : null;
}

function isUuid(value?: string): value is string {
  return Boolean(value && uuidPattern.test(value));
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof WorkspaceAccessError ? error.status : 500;
  return NextResponse.json({ error: getErrorMessage(error, fallback) }, { status });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}
