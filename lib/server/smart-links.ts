import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export const smartLinkPlatformKeys = [
  "spotify",
  "apple_music",
  "youtube_music",
  "amazon_music",
  "deezer",
  "custom"
] as const;

export const smartLinkStatuses = ["draft", "published", "disabled", "archived"] as const;
export const smartLinkPixelModes = ["inherit", "override", "disabled"] as const;

type SmartLinkPlatformKey = (typeof smartLinkPlatformKeys)[number];
type SmartLinkPixelMode = (typeof smartLinkPixelModes)[number];

const socialPlatforms = new Set(["instagram", "facebook", "youtube", "tiktok", "threads", "website", "custom"]);
// Kept local because the Phase 1B contract verifies the management guard
// independently of the edge-compatible public-route matcher.
const reservedSlugs = new Set([
  "api", "_next", "artistdeck", "budget", "dashboard", "events", "favicon.ico",
  "forgot-password", "login", "marketing", "no-workspace", "platform", "platforms",
  "privacy", "production", "roadmap", "robots.txt", "set-password", "sitemap.xml",
  "studio", "terms", "workspace-unavailable"
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pixelIdPattern = /^\d{5,32}$/;

export class SmartLinkInputError extends Error {}

export type NormalizedDestination = {
  id?: string;
  platformKey: SmartLinkPlatformKey;
  buttonLabel: string;
  targetUrl: string;
  sourceKind: "manual" | "catalog";
  sourceMetadata: Record<string, unknown>;
  position: number;
  isEnabled: boolean;
  retire: boolean;
};

export function smartLinkResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}

export function isSameOriginSmartLinkWrite(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    return Boolean(origin && host && new URL(origin).host === host);
  } catch {
    return false;
  }
}

export async function requireSmartLinkManager(request: NextRequest) {
  const access = await requireWorkspaceAccess(request);
  if (access.role === "viewer") {
    throw new SmartLinkAccessError("Viewers cannot manage Smart Links.", 403);
  }
  return access;
}

export class SmartLinkAccessError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function normalizeSlug(value: unknown, fallbackTitle?: unknown) {
  const supplied = typeof value === "string" ? value.trim() : "";
  const source = supplied || (typeof fallbackTitle === "string" ? fallbackTitle : "");
  const slug = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!slug || slug.length < 2) {
    return `smart-link-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new SmartLinkInputError("Smart Link slug is invalid.");
  if (reservedSlugs.has(slug)) throw new SmartLinkInputError("This Smart Link slug is reserved.");
  return slug;
}

export function validateExplicitSlug(value: unknown) {
  if (typeof value !== "string") throw new SmartLinkInputError("Smart Link slug is required.");
  const slug = value.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new SmartLinkInputError("Smart Link slug must use 2 to 80 lowercase letters, numbers, and hyphens.");
  }
  if (reservedSlugs.has(slug)) throw new SmartLinkInputError("This Smart Link slug is reserved.");
  return slug;
}

export function normalizeDestinations(value: unknown, { requireOne = false } = {}) {
  if (!Array.isArray(value)) throw new SmartLinkInputError("Destinations must be an array.");
  if (value.length > smartLinkPlatformKeys.length) throw new SmartLinkInputError("A Smart Link supports at most six destination slots.");
  if (requireOne && value.length === 0) throw new SmartLinkInputError("At least one destination is required.");
  const seen = new Set<string>();
  const seenPositions = new Set<number>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new SmartLinkInputError("A Smart Link destination is invalid.");
    const platformKey = entry.platformKey;
    if (typeof platformKey !== "string" || !smartLinkPlatformKeys.includes(platformKey as SmartLinkPlatformKey)) {
      throw new SmartLinkInputError("Smart Link destination platform is invalid.");
    }
    if (seen.has(platformKey)) throw new SmartLinkInputError("Each Smart Link destination platform may be used once.");
    seen.add(platformKey);
    const targetUrl = validateHttpsUrl(entry.targetUrl, "Destination URL");
    const sourceKind = entry.sourceKind === "catalog" ? "catalog" : "manual";
    const position = normalizePosition(entry.position, index);
    if (seenPositions.has(position)) throw new SmartLinkInputError("Smart Link destination positions must be unique.");
    seenPositions.add(position);
    return {
      id: optionalUuid(entry.id, "Destination id") ?? undefined,
      platformKey: platformKey as SmartLinkPlatformKey,
      buttonLabel: normalizeText(entry.buttonLabel, 80, "Destination label"),
      targetUrl,
      sourceKind,
      sourceMetadata: normalizeObject(entry.sourceMetadata, "Destination source metadata"),
      position,
      isEnabled: entry.isEnabled === undefined ? true : expectBoolean(entry.isEnabled, "Destination visibility"),
      retire: entry.retire === undefined ? false : expectBoolean(entry.retire, "Destination retirement")
    } satisfies NormalizedDestination;
  });
}

export function normalizeSocialLinks(value: unknown) {
  if (!Array.isArray(value)) throw new SmartLinkInputError("Social links must be an array.");
  if (value.length > 12) throw new SmartLinkInputError("A Smart Link supports at most twelve social links.");
  return value.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.platform !== "string" || !socialPlatforms.has(entry.platform)) {
      throw new SmartLinkInputError("Social link platform is invalid.");
    }
    return {
      platform: entry.platform,
      label: normalizeText(entry.label, 80, "Social link label"),
      url: validateHttpsUrl(entry.url, "Social link URL"),
      position: normalizePosition(entry.position, index),
      isEnabled: entry.isEnabled === undefined ? true : expectBoolean(entry.isEnabled, "Social link visibility")
    };
  });
}

export function normalizePixelId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !pixelIdPattern.test(value.trim())) {
    throw new SmartLinkInputError("Meta Pixel ID must contain 5 to 32 digits.");
  }
  return value.trim();
}

export function normalizeLinkPatch(value: unknown) {
  if (!isRecord(value)) throw new SmartLinkInputError("Smart Link update is invalid.");
  const patch: Record<string, unknown> = {};
  if ("slug" in value) patch.slug = validateExplicitSlug(value.slug);
  if ("productionSongId" in value) patch.productionSongId = optionalUuid(value.productionSongId, "Production song id") ?? "";
  if ("titleOverride" in value) patch.titleOverride = normalizeText(value.titleOverride, 200, "Title") || "";
  if ("artistNameOverride" in value) patch.artistNameOverride = normalizeText(value.artistNameOverride, 200, "Artist name") || "";
  if ("artworkUrlOverride" in value) patch.artworkUrlOverride = optionalHttpsUrl(value.artworkUrlOverride, "Artwork URL") ?? "";
  if ("backgroundMode" in value) {
    if (value.backgroundMode !== "blurred-artwork" && value.backgroundMode !== "solid-color") throw new SmartLinkInputError("Background mode is invalid.");
    patch.backgroundMode = value.backgroundMode;
  }
  if ("backgroundColor" in value) {
    if (value.backgroundColor !== null && value.backgroundColor !== "" && (typeof value.backgroundColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.backgroundColor))) {
      throw new SmartLinkInputError("Background color must be a six-digit hex value.");
    }
    patch.backgroundColor = value.backgroundColor || "";
  }
  if ("socialLinks" in value) patch.socialLinks = normalizeSocialLinks(value.socialLinks);
  if ("pixelMode" in value) {
    if (typeof value.pixelMode !== "string" || !smartLinkPixelModes.includes(value.pixelMode as SmartLinkPixelMode)) throw new SmartLinkInputError("Pixel mode is invalid.");
    patch.pixelMode = value.pixelMode;
  }
  if ("pixelOverrideId" in value) patch.pixelOverrideId = normalizePixelId(value.pixelOverrideId) ?? "";
  if ("destinations" in value) patch.destinations = normalizeDestinations(value.destinations);
  if (Object.keys(patch).length === 0) throw new SmartLinkInputError("No Smart Link changes were supplied.");
  const pixelMode = patch.pixelMode;
  const pixelOverrideId = patch.pixelOverrideId;
  if (pixelMode === "override" && !pixelOverrideId) throw new SmartLinkInputError("An override Pixel ID is required.");
  if (pixelMode && pixelMode !== "override" && pixelOverrideId) throw new SmartLinkInputError("Only override mode may include a Pixel ID.");
  return patch;
}

export function validateRevision(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new SmartLinkInputError("A current Smart Link revision is required.");
  return value;
}

export function validateLifecycleTarget(value: unknown) {
  if (typeof value !== "string" || !smartLinkStatuses.includes(value as (typeof smartLinkStatuses)[number])) {
    throw new SmartLinkInputError("Smart Link lifecycle status is invalid.");
  }
  return value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function errorStatus(error: unknown) {
  if (error instanceof SmartLinkInputError) return 400;
  if (error instanceof SmartLinkAccessError) return error.status;
  if (error instanceof WorkspaceAccessError) return error.status;
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  if (code === "23505") return 409;
  if (code === "40001") return 409;
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  return 500;
}

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
}

function validateHttpsUrl(value: unknown, label: string) {
  if (typeof value !== "string" || value.length > 2000) throw new SmartLinkInputError(`${label} is invalid.`);
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:") throw new Error("not https");
    return parsed.toString();
  } catch {
    throw new SmartLinkInputError(`${label} must use HTTPS.`);
  }
}

function optionalHttpsUrl(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  return validateHttpsUrl(value, label);
}

function normalizeText(value: unknown, max: number, label: string) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new SmartLinkInputError(`${label} is invalid.`);
  const normalized = value.trim();
  if (normalized.length > max) throw new SmartLinkInputError(`${label} is too long.`);
  return normalized;
}

function optionalUuid(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  if (!isUuid(value)) throw new SmartLinkInputError(`${label} is invalid.`);
  return value;
}

function normalizeObject(value: unknown, label: string) {
  if (value === undefined) return {};
  if (!isRecord(value) || JSON.stringify(value).length > 4000) throw new SmartLinkInputError(`${label} is invalid.`);
  return value;
}

function normalizePosition(value: unknown, fallback: number) {
  const position = value === undefined ? fallback : value;
  if (!Number.isInteger(position) || typeof position !== "number" || position < 0 || position > 5) {
    throw new SmartLinkInputError("Destination position is invalid.");
  }
  return position;
}

function expectBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") throw new SmartLinkInputError(`${label} is invalid.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
