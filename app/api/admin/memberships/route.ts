import { NextResponse, type NextRequest } from "next/server";

import {
  requireWorkspaceAdministrator,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

type WorkspaceRole = "admin" | "member" | "viewer";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    const { data: memberships, error: membershipError } = await serviceClient
      .from("app_workspace_members")
      .select("user_id, role, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    if (membershipError) throw membershipError;

    const userIds = (memberships ?? []).map((membership) => membership.user_id);
    const { data: profiles, error: profileError } = userIds.length
      ? await serviceClient
          .from("app_profiles")
          .select("id, avatar_path, display_name")
          .in("id", userIds)
      : { data: [], error: null };
    if (profileError) throw profileError;

    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const members = await Promise.all(
      (memberships ?? []).map(async (membership) => {
        const profile = profilesById.get(membership.user_id);
        const { data: authUser, error: authError } = await serviceClient.auth.admin.getUserById(
          membership.user_id
        );
        if (authError) throw authError;

        const avatarPath = profile?.avatar_path ?? "";
        const { data: avatar } = avatarPath
          ? await serviceClient.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60)
          : { data: null };

        return {
          avatarUrl: avatar?.signedUrl ?? null,
          displayName: profile?.display_name?.trim() || authUser.user.email || "Member",
          email: authUser.user.email ?? "",
          role: membership.role as WorkspaceRole,
          userId: membership.user_id
        };
      })
    );

    return NextResponse.json({ currentUserId: user.id, members });
  } catch (error) {
    return errorResponse(error, "Workspace members could not be loaded.");
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    const payload = (await request.json()) as { role?: string; userId?: string };
    const role = normalizeRole(payload.role);
    if (!role || !isUuid(payload.userId)) {
      return NextResponse.json({ error: "Choose a valid member and workspace role." }, { status: 400 });
    }
    if (payload.userId === user.id) {
      return NextResponse.json(
        { error: "Admins cannot change their own workspace role." },
        { status: 403 }
      );
    }

    const { data, error } = await serviceClient
      .from("app_workspace_members")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("user_id", payload.userId)
      .select("user_id, role")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Workspace member was not found." }, { status: 404 });

    return NextResponse.json({ member: { role: data.role, userId: data.user_id }, status: "updated" });
  } catch (error) {
    return errorResponse(error, "Workspace role could not be updated.");
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    const payload = (await request.json()) as { userId?: string };
    if (!isUuid(payload.userId)) {
      return NextResponse.json({ error: "Choose a valid workspace member." }, { status: 400 });
    }
    if (payload.userId === user.id) {
      return NextResponse.json(
        { error: "Admins cannot remove their own workspace membership." },
        { status: 403 }
      );
    }

    const { data, error } = await serviceClient
      .from("app_workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", payload.userId)
      .select("user_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Workspace member was not found." }, { status: 404 });

    return NextResponse.json({ status: "removed", userId: data.user_id });
  } catch (error) {
    return errorResponse(error, "Workspace member could not be removed.");
  }
}

function normalizeRole(value?: string): WorkspaceRole | null {
  return value === "admin" || value === "member" || value === "viewer" ? value : null;
}

function isUuid(value?: string): value is string {
  return Boolean(value && uuidPattern.test(value));
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("at least one Admin")) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  const status = error instanceof WorkspaceAccessError ? error.status : 500;
  return NextResponse.json({ error: message }, { status });
}
