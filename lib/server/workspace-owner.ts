import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  activeWorkspaceCookieName,
  parseWorkspaceId,
  resolveWorkspaceMembership
} from "@/lib/workspace";

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

export type WorkspaceRole = "admin" | "member" | "viewer";

export async function requirePlatformOwner(request: NextRequest) {
  const user = await requireAuthenticatedUser(request);
  const serviceClient = createServiceSupabaseClient();
  const { data: operator, error } = await serviceClient
    .from("app_platform_operators")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!operator) {
    throw new WorkspaceAccessError("Only a platform operator can create workspaces.", 403);
  }
  return { serviceClient, user };
}

export async function requireWorkspaceAdministrator(request: NextRequest) {
  const access = await requireWorkspaceAccess(request);

  if (access.role !== "admin") {
    throw new WorkspaceAccessError(
      "Only a workspace Admin can manage workspace administration.",
      403
    );
  }

  return access;
}

export async function requireWorkspaceAccess(request: NextRequest) {
  const user = await requireAuthenticatedUser(request);
  const serviceClient = createServiceSupabaseClient();
  const { data: memberships, error: membershipError } = await serviceClient
    .from("app_workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) throw membershipError;
  const requestedWorkspaceId = parseWorkspaceId(
    request.cookies.get(activeWorkspaceCookieName)?.value
  );
  const membership = resolveWorkspaceMembership(memberships, requestedWorkspaceId);
  if (!membership) {
    throw new WorkspaceAccessError("Workspace access denied.", 403);
  }

  return { role: membership.role as WorkspaceRole, serviceClient, user, workspaceId: membership.workspace_id };
}

export async function requireAuthenticatedUser(request: NextRequest) {
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

  return user;
}

export function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase administration is not configured.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
