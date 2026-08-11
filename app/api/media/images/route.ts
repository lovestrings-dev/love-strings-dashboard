import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const allowedModules = ["production", "marketing", "events", "qr"] as const;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumFileSize = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { role, serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    if (role === "viewer") return NextResponse.json({ error: "Viewers cannot upload workspace images." }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    const assetClass = form.get("module");
    if (!(file instanceof File) || !allowedModules.includes(assetClass as (typeof allowedModules)[number])) {
      return NextResponse.json({ error: "Choose a supported image destination." }, { status: 400 });
    }
    if (!allowedMimeTypes.has(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
    if (file.size === 0 || file.size > maximumFileSize) return NextResponse.json({ error: "Images must be no larger than 8 MB." }, { status: 400 });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary uploads are not configured. Ask a workspace Admin to add the server Cloudinary credentials.");

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `workspaces/${workspaceId}/${assetClass}`;
    const publicId = randomUUID();
    const { data: workspace, error: workspaceError } = await serviceClient
      .from("app_workspaces").select("name").eq("id", workspaceId).single();
    if (workspaceError) throw workspaceError;
    const context = `workspace_id=${workspaceId}|workspace_name=${sanitizeContextValue(workspace.name)}|asset_class=${assetClass}|source=ls-dashboard`;
    const tags = `ls-dashboard,workspace-${workspaceId},module-${assetClass}`;
    const transformation = assetClass === "qr"
      ? "c_limit,h_1000,w_1000"
      : "c_limit,h_2000,w_2000,q_auto";
    const signature = signUpload({ context, folder, public_id: publicId, tags, timestamp, transformation }, apiSecret);
    const cloudinaryForm = new FormData();
    cloudinaryForm.set("api_key", apiKey);
    cloudinaryForm.set("context", context);
    cloudinaryForm.set("file", file);
    cloudinaryForm.set("folder", folder);
    cloudinaryForm.set("public_id", publicId);
    cloudinaryForm.set("signature", signature);
    cloudinaryForm.set("timestamp", String(timestamp));
    cloudinaryForm.set("tags", tags);
    cloudinaryForm.set("transformation", transformation);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: cloudinaryForm });
    const result = await response.json() as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Cloudinary image upload failed.");
    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image upload failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

function signUpload(parameters: Record<string, string | number>, secret: string) {
  const serialized = Object.entries(parameters).sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${value}`).join("&");
  return createHash("sha1").update(`${serialized}${secret}`).digest("hex");
}

function sanitizeContextValue(value: string) {
  return value.trim().replace(/[|=\\]/g, " ").slice(0, 250) || "Unnamed workspace";
}

function isSameOrigin(request: NextRequest) {
  try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; }
}
