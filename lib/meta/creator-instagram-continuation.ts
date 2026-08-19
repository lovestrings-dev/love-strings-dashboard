import { cleanCreatorSocialContinuation, readCreatorSocialContinuation } from "./creator-social-continuation";

const resultPrefix = "creator-social-instagram-";
export type CreatorInstagramContinuationResult = "duplicate" | "error" | null;

export function readCreatorInstagramContinuationResult(input: string | URL): CreatorInstagramContinuationResult {
  const continuation = readCreatorSocialContinuation(input);
  if (continuation?.target !== "standalone-instagram") return null;
  return continuation.result === "duplicate" ? "duplicate" : continuation.result === "error" ? "error" : null;
}

export function hasCreatorInstagramContinuation(input: string | URL) {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
  return url.searchParams.get("oauth")?.startsWith(resultPrefix) ?? false;
}

export function cleanCreatorInstagramContinuation(input: string | URL) {
  if (hasCreatorInstagramContinuation(input)) return cleanCreatorSocialContinuation(input);
  const url = typeof input === "string" ? new URL(input, "http://localhost") : new URL(input.toString());
  return `${url.pathname}${url.search}${url.hash}`;
}
