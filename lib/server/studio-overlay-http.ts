import { NextResponse, type NextRequest } from "next/server";
import { WorkspaceAccessError } from "./workspace-owner";
export function sameOrigin(r: NextRequest) { try { return new URL(r.headers.get("origin") ?? "").host === r.headers.get("host"); } catch { return false; } }
export function failure(e: unknown) { console.error("Studio overlay request failed", { name: e instanceof Error ? e.name : "Unknown", message: e instanceof Error ? e.message.slice(0, 240) : "Unknown" }); return NextResponse.json({ error: e instanceof WorkspaceAccessError ? e.message : "Overlay settings could not be loaded or saved." }, { status: e instanceof WorkspaceAccessError ? e.status : 500 }); }
