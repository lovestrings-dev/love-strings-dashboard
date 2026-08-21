"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { currentAuthCallback, postAuthDecision, shouldUseExistingSession } from "@/lib/provisioning-auth-flow";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [userName, setUserName] = useState(""); const [artistName, setArtistName] = useState("");
  const [provisioningToken, setProvisioningToken] = useState(""); const [isProvisioning, setIsProvisioning] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false); const [hasChecked, setHasChecked] = useState(false);
  const [isReady, setIsReady] = useState(false); const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceJoin, setWorkspaceJoin] = useState(false); const [message, setMessage] = useState("");
  const complete = useRef(false); const accessToken = useRef("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    void establish();
    async function establish() {
      if (complete.current) return;
      const query = new URLSearchParams(window.location.search), hash = new URLSearchParams(window.location.hash.slice(1));
      const callback = currentAuthCallback(query, hash);
      const ordinary = query.get("workspace_invitation");
      const hasProvisioningHint = query.has("provisioning_invitation");
      let session: Session | null = null;
      // An Auth callback must always win over a persisted browser session. In
      // particular, never let User A's existing session consume User B's link.
      if (callback?.kind === "code") {
        const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
        if (error) return rejectCallback();
        session = data.session;
      } else if (callback?.kind === "hash") {
        const { data, error } = await supabase.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
        if (error) return rejectCallback();
        session = data.session;
      } else if (callback?.kind === "otp") {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: callback.tokenHash, type: callback.type });
        if (error) return rejectCallback();
        session = data.session;
      } else if (shouldUseExistingSession({ callback, hasProvisioningHint })) {
        // Ordinary workspace invitations retain their existing flow. Their
        // server-side acceptance function independently checks the email.
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }
      if (!session) return rejectCallback();
      accessToken.current = session.access_token;
      if (ordinary) {
        const response = await fetch("/api/invitations/accept", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ token: ordinary }) });
        if (!response.ok) { setMessage(((await response.json()) as { error?: string }).error || "Invitation could not be accepted."); setIsReady(true); setHasChecked(true); return; }
      }
      const continuationResponse = await fetch("/api/platform/provisioning-invitations/continuation", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const continuationPayload = await continuationResponse.json() as { continuation?: { displayName: string; token: string } | null; error?: string };
      const continuation = continuationResponse.ok ? continuationPayload.continuation ? "one" : "none" : continuationResponse.status === 409 ? "ambiguous" : "error";
      const decision = postAuthDecision({ callback, continuation, hasProvisioningHint, ordinaryInvitation: Boolean(ordinary), workspaceJoin: query.get("workspace_join") === "1" });
      if (decision.kind === "provisioning" && continuationPayload.continuation) {
        setUserName(continuationPayload.continuation.displayName || session.user.email?.split("@")[0] || "");
        setProvisioningToken(continuationPayload.continuation.token);
        setNeedsPassword(decision.needsPassword);
        setIsProvisioning(true); complete.current = true; setIsReady(true); setHasChecked(true); return;
      }
      if (decision.kind === "error") { complete.current = true; setMessage(continuationPayload.error || decision.message); setIsReady(true); setHasChecked(true); return; }
      complete.current = true;
      if (decision.kind === "redirect-home") { window.location.assign("/"); return; }
      if (decision.kind === "redirect-workspace") { setWorkspaceJoin(true); window.history.replaceState({}, "", "/set-password"); window.location.assign("/"); return; }
      setIsReady(true); setHasChecked(true);
    }
    function rejectCallback() {
      complete.current = true;
      setMessage("This sign-in link could not be verified. It may already have been used; open a current link for the invited account.");
      setIsReady(true); setHasChecked(true);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (needsPassword && password.length < 8) return setMessage("Use at least 8 characters.");
    if (needsPassword && password !== confirmation) return setMessage("Passwords do not match.");
    if (isProvisioning && !userName.trim()) return setMessage("Enter your name to continue.");
    if (isProvisioning && !artistName.trim()) return setMessage("Enter an Artist or Band Name to continue.");
    setIsSubmitting(true); const supabase = createBrowserSupabaseClient();
    if (needsPassword) {
      const { error } = await supabase.auth.updateUser({ password }); if (error) { setMessage(error.message); setIsSubmitting(false); return; }
      if (isProvisioning) { setNeedsPassword(false); setIsSubmitting(false); return; }
    }
    if (!isProvisioning) { router.replace("/"); router.refresh(); return; }
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/platform/provisioning-invitations/accept", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token || accessToken.current}`, "Content-Type": "application/json" }, body: JSON.stringify({ artistName, token: provisioningToken, userName }) });
    if (!response.ok) { setMessage(((await response.json()) as { error?: string }).error || "Workspace provisioning could not be completed."); setIsSubmitting(false); return; }
    window.location.assign("/");
  }

  const title = isProvisioning && !needsPassword ? "Set up your ArtistDeck workspace" : "Choose your password";
  return <main className="login-page"><section className="login-panel" aria-labelledby="password-title"><span aria-hidden className="login-logo login-logo-neutral">AD</span><div><p className="eyebrow">ArtistDeck</p><h1 id="password-title">{title}</h1></div>
    {!hasChecked ? <p>Checking invitation...</p> : message && !isProvisioning ? <p className="login-error" role="alert">{message}</p> : !isReady ? <p className="login-error" role="alert">This invitation could not be verified. Request a fresh invitation and open its link only once.</p> : workspaceJoin ? <p>Joining workspace...</p> : <form className="login-form" onSubmit={submit}>
      {needsPassword ? <><label>New password<input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label><label>Confirm password<input autoComplete="new-password" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label></> : null}
      {isProvisioning && !needsPassword ? <><label>Your name<input autoComplete="name" maxLength={120} onChange={(event) => setUserName(event.target.value)} required value={userName} /></label><label>Artist / Band Name<input autoComplete="organization" maxLength={120} minLength={2} onChange={(event) => setArtistName(event.target.value)} required value={artistName} /></label><p>Your workspace address will be created automatically.</p></> : null}
      {message ? <p className="login-error" role="alert">{message}</p> : null}<button disabled={isSubmitting} type="submit">{isSubmitting ? "Creating workspace..." : needsPassword ? "Save password" : isProvisioning ? "Create workspace" : "Save password"}</button>
    </form>}</section></main>;
}
