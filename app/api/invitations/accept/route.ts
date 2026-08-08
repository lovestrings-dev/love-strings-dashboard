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
    const { data: acceptanceRows, error: acceptanceError } = await serviceClient.rpc(
      "accept_workspace_invitation",
      {
        p_email: user.email,
        p_token_hash: tokenHash,
        p_user_id: user.id
      }
    );
    if (acceptanceError) {
      return NextResponse.json(
        { error: "Workspace membership could not be created. Please try again." },
        { status: 500 }
      );
    }

    const acceptance = acceptanceRows?.[0];
    if (!acceptance || acceptance.outcome === "invalid") {
      return NextResponse.json({ error: "This invitation is not valid for this account." }, { status: 403 });
    }
    if (acceptance.outcome === "expired") {
      return NextResponse.json({ error: "This workspace invitation has expired." }, { status: 410 });
    }
    if (acceptance.outcome === "revoked") {
      return NextResponse.json({ error: "This workspace invitation has been revoked." }, { status: 410 });
    }
    if (acceptance.outcome === "already_accepted") {
      return NextResponse.json({ error: "This invitation has already been accepted." }, { status: 409 });
    }

    const workspaceId = parseWorkspaceId(acceptance.workspace_id);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace access could not be established. Please try again." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ status: "accepted", workspaceId });
    response.cookies.set(activeWorkspaceCookieName, workspaceId, {
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
