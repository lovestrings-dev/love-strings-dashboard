const fstatsLoginReturnPrefix = "fstats-login-";

export function hasFstatsLoginContinuation(input: string | URL) {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
  return url.searchParams.get("meta")?.startsWith(fstatsLoginReturnPrefix) ?? false;
}

export function cleanConsumedFstatsLoginContinuation(input: string | URL) {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : new URL(input.toString());
  if (url.searchParams.get("settings") === "general") url.searchParams.delete("settings");
  if (url.searchParams.get("meta")?.startsWith(fstatsLoginReturnPrefix)) url.searchParams.delete("meta");
  if (url.hash === "#_=_") url.hash = "";
  return `${url.pathname}${url.search}${url.hash}`;
}
