import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const loveStringsWorkspaceId = "00000000-0000-0000-0000-000000000001";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class WorkspaceAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WorkspaceAccessError";
    this.status = status;
  }
}

export async function requireWorkspaceOwner(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase authentication is not configured.");
  }

  const userClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined
    }
  });
  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new WorkspaceAccessError("Sign in again to continue.", 401);
  }

  const serviceClient = createServiceSupabaseClient();
  const { data: membership, error: membershipError } = await serviceClient
    .from("app_workspace_members")
    .select("role")
    .eq("workspace_id", loveStringsWorkspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (membership?.role !== "owner") {
    throw new WorkspaceAccessError("Only a workspace Owner can manage integrations.", 403);
  }

  return { serviceClient, user };
}

export function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase administration is not configured.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

