import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { sendWorkspaceInvitationEmail } from "@/lib/server/workspace-invitation-email";
import {
  requirePlatformOwner,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

const invitationLifetimeMs = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { serviceClient, user } = await requirePlatformOwner(request);
    const payload = (await request.json()) as { email?: string };
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!isEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + invitationLifetimeMs).toISOString();
    const { data, error } = await serviceClient.rpc(
      "create_provisional_workspace_admin_invitation",
      {
        p_created_by: user.id,
        p_email: email,
        p_expires_at: expiresAt,
        p_token_hash: createHash("sha256").update(token).digest("hex")
      }
    );
    if (error) throw error;

    const staged = data?.[0];
    if (!staged?.workspace_id || !staged.invitation_id) {
      throw new Error("The provisional workspace invitation was not created.");
    }

    if (!staged.created) {
      return NextResponse.json({
        email,
        invitationId: staged.invitation_id,
        status: "already_pending",
        workspaceId: staged.workspace_id
      });
    }

    try {
      const delivery = await sendWorkspaceInvitationEmail(serviceClient, email, token);
      return NextResponse.json({
        delivery,
        email,
        invitationId: staged.invitation_id,
        status: "sent",
        workspaceId: staged.workspace_id
      });
    } catch (deliveryError) {
      const { error: cleanupError } = await serviceClient
        .from("app_workspaces")
        .delete()
        .eq("id", staged.workspace_id)
        .eq("setup_state", "pending_setup");
      if (cleanupError) {
        throw new Error(
          `Invitation delivery failed and provisional-workspace cleanup also failed: ${cleanupError.message}`
        );
      }
      throw deliveryError;
    }
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Workspace Admin invitation could not be sent.") },
      { status: error instanceof WorkspaceAccessError ? error.status : 500 }
    );
  }
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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}
