import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  requireWorkspaceAdministrator,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

type WorkspaceRole = "admin" | "member" | "owner" | "viewer";

const productionAppUrl = "https://love-strings-dashboard.vercel.app";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { role: inviterRole, serviceClient, user: inviter, workspaceId } =
      await requireWorkspaceAdministrator(request);

    const payload = (await request.json()) as { email?: string; role?: string };
    const email = payload.email?.trim().toLowerCase() ?? "";
    const role = normalizeRole(payload.role);

    if (!isEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json({ error: "Choose a valid workspace role." }, { status: 400 });
    }
    if (!canAssignRole(inviterRole, role)) {
      return NextResponse.json(
        { error: "Only a workspace Owner can invite Owners or Admins." },
        { status: 403 }
      );
    }

    const invitationToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(invitationToken).digest("hex");
    const { data: workspaceInvitation, error: workspaceInvitationError } =
      await serviceClient
        .from("app_workspace_invitations")
        .insert({
          created_by: inviter.id,
          email,
          role,
          token_hash: tokenHash,
          workspace_id: workspaceId
        })
        .select("id")
        .single();
    if (workspaceInvitationError) {
      if (workspaceInvitationError.code === "23505") {
        return NextResponse.json(
          { error: "This email already has a pending invitation to this workspace." },
          { status: 409 }
        );
      }
      throw workspaceInvitationError;
    }

    const passwordSetupUrl = `${getPublicAppUrl()}/set-password?workspace_invitation=${invitationToken}`;
    const { data: invitation, error: invitationError } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: passwordSetupUrl }
    );

    if (invitationError) {
      const message = invitationError.message.toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        const { error: magicLinkError } = await serviceClient.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${passwordSetupUrl}&workspace_join=1`
          }
        });
        if (!magicLinkError) {
          return NextResponse.json({ email, role, status: "sent" });
        }
      }
      await serviceClient.from("app_workspace_invitations").delete().eq("id", workspaceInvitation.id);
      throw invitationError;
    }

    if (!invitation.user) {
      throw new Error("Supabase did not return the invited user.");
    }

    return NextResponse.json({ email, role, status: "sent" });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json(
      { error: getErrorMessage(error, "Invitation could not be sent.") },
      { status }
    );
  }
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
  return value === "owner" || value === "admin" || value === "member" || value === "viewer"
    ? value
    : null;
}

function canAssignRole(inviterRole: string, invitedRole: WorkspaceRole) {
  return inviterRole === "owner" || invitedRole === "member" || invitedRole === "viewer";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}
