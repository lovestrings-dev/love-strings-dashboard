export type AuthCallback =
  | { kind: "code"; code: string; type: string | null }
  | { kind: "hash"; accessToken: string; refreshToken: string; type: string | null }
  | { kind: "otp"; tokenHash: string; type: "invite" | "magiclink" | "recovery" };

export function currentAuthCallback(query: URLSearchParams, hash: URLSearchParams): AuthCallback | null {
  const type = query.get("type") ?? hash.get("type");
  if (query.get("code")) return { kind: "code", code: query.get("code")!, type };
  if (hash.get("access_token") && hash.get("refresh_token")) {
    return { kind: "hash", accessToken: hash.get("access_token")!, refreshToken: hash.get("refresh_token")!, type };
  }
  const tokenHash = query.get("token_hash");
  if (tokenHash && (type === "invite" || type === "magiclink" || type === "recovery")) {
    return { kind: "otp", tokenHash, type };
  }
  return null;
}

export function callbackNeedsPassword(callback: AuthCallback | null) {
  return callback?.type === "invite" || callback?.type === "recovery";
}
