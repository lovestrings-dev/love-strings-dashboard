export type AuthCallback =
  | { kind: "code"; code: string; type: string | null }
  | { kind: "hash"; accessToken: string; refreshToken: string; type: string | null }
  | { kind: "otp"; tokenHash: string; type: "invite" | "magiclink" | "recovery" };

export type ContinuationResult = "one" | "none" | "ambiguous" | "error";

export type PostAuthDecision =
  | { kind: "provisioning"; needsPassword: boolean }
  | { kind: "generic-password" }
  | { kind: "redirect-home" }
  | { kind: "redirect-workspace" }
  | { kind: "error"; message: string };

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

export function shouldUseExistingSession(input: {
  callback: AuthCallback | null;
  hasProvisioningHint: boolean;
}) {
  return !input.callback && !input.hasProvisioningHint;
}

export function postAuthDecision(input: {
  callback: AuthCallback | null;
  continuation: ContinuationResult;
  hasProvisioningHint: boolean;
  ordinaryInvitation: boolean;
  workspaceJoin: boolean;
}): PostAuthDecision {
  if (input.continuation === "one") {
    return { kind: "provisioning", needsPassword: input.callback?.type === "invite" || input.callback?.type === "recovery" };
  }
  if (input.continuation === "ambiguous") {
    return { kind: "error", message: "More than one active provisioning invitation exists. Ask the Platform Owner to resolve this." };
  }
  if (input.continuation === "error") {
    return { kind: "error", message: "Provisioning continuation could not be resolved." };
  }
  if (input.ordinaryInvitation) return input.workspaceJoin ? { kind: "redirect-workspace" } : { kind: "generic-password" };
  if (input.callback?.type === "recovery") return { kind: "generic-password" };
  if (input.callback || input.hasProvisioningHint) {
    return { kind: "error", message: "No active provisioning invitation was found for this account." };
  }
  return { kind: "redirect-home" };
}
