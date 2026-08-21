import { createHash, randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceSupabaseClient, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    const user = await authenticatedUser(request);
    if (!user?.email) throw new WorkspaceAccessError("Sign in again to continue.", 401);
    const service = createServiceSupabaseClient();
    const { data: invitations, error } = await service
      .from("app_workspace_provisioning_invitations")
      .select("id, token_hash")
      .eq("email", user.email.toLowerCase())
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(2);
    if (error) throw error;
    if (!invitations?.length) return NextResponse.json({ continuation: null });
    if (invitations.length > 1) {
      return NextResponse.json({ error: "More than one active provisioning invitation exists. Ask the Platform Owner to resolve this." }, { status: 409 });
    }
    const invitation = invitations[0];
    const token = randomBytes(32).toString("base64url");
    const { data: rotated, error: rotateError } = await service
      .from("app_workspace_provisioning_invitations")
      .update({ token_hash: hashToken(token) })
      .eq("id", invitation.id)
      .eq("token_hash", invitation.token_hash)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (rotateError) throw rotateError;
    if (!rotated) return NextResponse.json({ error: "The provisioning invitation changed. Please open the latest invitation link." }, { status: 409 });
    const { data: profile, error: profileError } = await service.from("app_profiles").select("display_name").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    return NextResponse.json({ continuation: { displayName: profile?.display_name?.trim() ?? "", token } });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provisioning continuation could not be resolved." }, { status });
  }
}

async function authenticatedUser(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase authentication is not configured.");
  const client = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } });
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data: { user }, error } = await client.auth.getUser(bearer);
  return error ? null : user;
}

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
