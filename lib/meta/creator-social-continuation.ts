export type CreatorSocialReturnTarget = "standalone-instagram" | "threads";
export type CreatorSocialReturnResult = "connected" | "duplicate" | "error";
export type CreatorSocialContinuation = { target: CreatorSocialReturnTarget; result: CreatorSocialReturnResult } | null;

const markers: Record<string, Exclude<CreatorSocialContinuation, null>> = {
  "creator-social-instagram-connected": { target: "standalone-instagram", result: "connected" },
  "creator-social-instagram-duplicate": { target: "standalone-instagram", result: "duplicate" },
  "creator-social-instagram-error": { target: "standalone-instagram", result: "error" },
  "creator-social-threads-connected": { target: "threads", result: "connected" },
  "creator-social-threads-error": { target: "threads", result: "error" }
};

export function readCreatorSocialContinuation(input: string | URL): CreatorSocialContinuation {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : input;
  return markers[url.searchParams.get("oauth") ?? ""] ?? null;
}

export function cleanCreatorSocialContinuation(input: string | URL) {
  const url = typeof input === "string" ? new URL(input, "http://localhost") : new URL(input.toString());
  if (readCreatorSocialContinuation(url)) url.searchParams.delete("oauth");
  return `${url.pathname}${url.search}${url.hash}`;
}
