import { NextResponse, type NextRequest } from "next/server";
import {
  requirePlatformOwner,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformOwner(request);
    return NextResponse.json({ canCreateWorkspaces: true });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ canCreateWorkspaces: false }, { status });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { serviceClient, user } = await requirePlatformOwner(request);
    const payload = (await request.json()) as { name?: string; slug?: string };
    const name = payload.name?.trim() ?? "";
    const slug = normalizeSlug(payload.slug);
    if (!isValidName(name) || !slug) {
      return NextResponse.json({ error: "Enter a valid workspace name and slug." }, { status: 400 });
    }

    const { data: workspaceId, error } = await serviceClient.rpc("provision_workspace", {
      p_initial_admin_id: user.id,
      p_name: name,
      p_slug: slug
    });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That workspace name or slug is already in use." }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ name, slug, status: "created", workspaceId });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workspace creation failed." },
      { status }
    );
  }
}

function normalizeSlug(value?: string) {
  const slug = value?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 ? slug : null;
}

function isValidName(value: string) {
  return value.length >= 2 && value.length <= 120;
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
