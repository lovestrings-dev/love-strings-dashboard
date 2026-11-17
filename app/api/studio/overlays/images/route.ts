import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";
import { studioStagingBucketName, studioStorage } from "@/lib/server/adstudio-storage";
import { sameOrigin, failure } from "@/lib/server/studio-overlay-http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { workspaceId, role } = await requireWorkspaceAccess(request);
    if (role === "viewer") return NextResponse.json({ error: "Viewers cannot upload overlays." }, { status: 403 });
    if (Number(request.headers.get("content-length")) > 5 * 1024 * 1024) return NextResponse.json({ error: "Choose an overlay image up to 4 MB." }, { status: 400 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Choose an overlay image up to 4 MB." }, { status: 400 });
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000, animated: false });
    const meta = await image.metadata();
    if (!["png", "jpeg", "webp", "gif"].includes(meta.format ?? "")) return NextResponse.json({ error: "Choose PNG, JPEG, WebP or GIF. GIF uses its first frame." }, { status: 400 });
    const bytes = await image.rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const objectPath = `workspaces/${workspaceId}/studio/overlay-assets/${randomUUID()}.png`;
    const storage = await studioStorage();
    await storage.bucket(studioStagingBucketName()).file(objectPath).save(bytes, { resumable: false, contentType: "image/png", preconditionOpts: { ifGenerationMatch: 0 } });
    return NextResponse.json({ source: { kind: "upload", objectPath } });
  } catch (e) { return failure(e); }
}
