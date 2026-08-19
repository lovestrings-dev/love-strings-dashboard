const resultPrefix = "creator-social-instagram-";
export type CreatorInstagramContinuationResult = "duplicate" | "error" | null;

export function readCreatorInstagramContinuationResult(input: string | URL): CreatorInstagramContinuationResult {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
  const result = url.searchParams.get("oauth");
  if (result === "creator-social-instagram-duplicate") return "duplicate";
  return result === "creator-social-instagram-error" ? "error" : null;
}

export function hasCreatorInstagramContinuation(input: string | URL) {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
  return url.searchParams.get("oauth")?.startsWith(resultPrefix) ?? false;
}

export function cleanCreatorInstagramContinuation(input: string | URL) {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : new URL(input.toString());
  if (url.searchParams.get("oauth")?.startsWith(resultPrefix)) url.searchParams.delete("oauth");
  return `${url.pathname}${url.search}${url.hash}`;
}
