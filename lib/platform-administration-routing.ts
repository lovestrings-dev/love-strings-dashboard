export function isPlatformAdministrationPath(pathname: string) {
  return pathname === "/platform" || pathname.startsWith("/api/platform/");
}
