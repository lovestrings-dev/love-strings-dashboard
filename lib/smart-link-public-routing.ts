const reservedSmartLinkSlugs = new Set([
  "api", "_next", "artistdeck", "budget", "dashboard", "events", "favicon.ico",
  "forgot-password", "login", "marketing", "no-workspace", "platform", "platforms",
  "privacy", "production", "roadmap", "robots.txt", "set-password", "sitemap.xml",
  "studio", "terms", "workspace-unavailable"
]);

const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isReservedSmartLinkSlug(value: string) {
  return reservedSmartLinkSlugs.has(value);
}

/** True only for the one-segment public Smart Link namespace. */
export function isPublicSmartLinkPathname(pathname: string) {
  const match = /^\/([^/]+)$/.exec(pathname);
  if (!match) return false;
  const slug = match[1];
  return slug.length >= 2 && slug.length <= 80 && publicSlugPattern.test(slug) && !isReservedSmartLinkSlug(slug);
}
