const resultPrefix = "creator-social-instagram-";

export function hasCreatorInstagramContinuation(input: string | URL) {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
  return url.searchParams.get("oauth")?.startsWith(resultPrefix) ?? false;
}

export function cleanCreatorInstagramContinuation(input: string | URL) {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : new URL(input.toString());
  if (url.searchParams.get("oauth")?.startsWith(resultPrefix)) url.searchParams.delete("oauth");
  return `${url.pathname}${url.search}${url.hash}`;
}
