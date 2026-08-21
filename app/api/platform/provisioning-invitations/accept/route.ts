import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { activeWorkspaceCookieName, parseWorkspaceId } from "@/lib/workspace";
import { createServiceSupabaseClient, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as { artistName?: string; token?: string; userName?: string };
    if (!payload.token || payload.token.length < 32) return NextResponse.json({ error: "This provisioning invitation is invalid." }, { status: 400 });
    const user = await authenticatedUser(request);
    if (!user) throw new WorkspaceAccessError("Sign in again to continue.", 401);
    const { data, error } = await createServiceSupabaseClient().rpc("accept_workspace_provisioning_invitation", {
      p_display_name: payload.userName ?? "", p_token_hash: createHash("sha256").update(payload.token).digest("hex"), p_user_id: user.id, p_workspace_name: payload.artistName ?? ""
    });
    if (error) throw error;
    const result = data?.[0];
    const messages: Record<string, string> = { already_accepted: "This invitation was accepted by a different account.", expired: "This invitation has expired. Ask the Platform Owner to resend it.", invalid: "This invitation is not valid for this account.", invalid_profile: "Enter your name to continue.", invalid_workspace_name: "Enter an Artist or Band Name to continue.", revoked: "This invitation has been revoked." };
    if (!result || result.outcome !== "accepted") return NextResponse.json({ error: messages[result?.outcome] ?? "Workspace provisioning could not be completed." }, { status: result?.outcome === "expired" || result?.outcome === "revoked" ? 410 : 403 });
    const workspaceId = parseWorkspaceId(result.workspace_id);
    if (!workspaceId) throw new Error("Provisioning did not return a workspace.");
    const response = NextResponse.json({ status: "accepted", workspaceId });
    response.cookies.set(activeWorkspaceCookieName, workspaceId, { httpOnly: true, path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
    return response;
  } catch (error) { const status = error instanceof WorkspaceAccessError ? error.status : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace provisioning failed." }, { status }); }
}
async function authenticatedUser(request: NextRequest) { if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase authentication is not configured."); const client = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } }); const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]; const { data: { user }, error } = await client.auth.getUser(bearer); return error ? null : user; }
