"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LoaderCircle } from "lucide-react";
import { ArtistDeckLoading, ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";
import { createBrowserSupabaseCallbackClient, createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { callbackNeedsPassword, currentAuthCallback } from "@/lib/auth-callback";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [flow, setFlow] = useState<"invitation" | "recovery" | null>(null); const [hasChecked, setHasChecked] = useState(false);
  const [isReady, setIsReady] = useState(false); const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(""); const [isInvalidLink, setIsInvalidLink] = useState(false); const [isResetComplete, setIsResetComplete] = useState(false);
  const complete = useRef(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseCallbackClient();
    void establish();
    async function establish() {
      if (complete.current) return;
      const query = new URLSearchParams(window.location.search), hash = new URLSearchParams(window.location.hash.slice(1));
      const callback = currentAuthCallback(query, hash);
      const ordinary = query.get("workspace_invitation");
      const isRecoveryDestination = query.get("recovery") === "1";
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
      } else {
        // Without an Auth callback, a signed-in recipient may still accept an
        // ordinary workspace invitation. The acceptance endpoint independently
        // verifies both the invitation and the recipient's Auth email.
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }
      if (!session) return rejectCallback();
      if (ordinary) {
        const response = await fetch("/api/invitations/accept", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ token: ordinary }) });
        if (!response.ok) { setMessage(((await response.json()) as { error?: string }).error || "Invitation could not be accepted."); setIsInvalidLink(true); setIsReady(true); setHasChecked(true); return; }
      }
      complete.current = true;
      window.history.replaceState({}, "", "/set-password");
      // Invitation tokens always take precedence over a recovery marker. Recovery
      // never reaches workspace acceptance because its fixed redirect has no token.
      if (ordinary && callbackNeedsPassword(callback)) {
        setFlow("invitation");
      } else if (!ordinary && callback && (isRecoveryDestination || callback.type === "recovery")) {
        setFlow("recovery");
      } else {
        window.location.assign("/");
        return;
      }
      setIsReady(true); setHasChecked(true);
    }
    function rejectCallback() {
      complete.current = true;
      setMessage("This reset or invitation link could not be verified. It may be expired or already used.");
      setIsInvalidLink(true);
      setIsReady(true); setHasChecked(true);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!flow || password.length < 8) return setMessage("Use at least 8 characters.");
    if (password !== confirmation) return setMessage("Passwords do not match.");
    setIsSubmitting(true); const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const isSamePassword = error.code === "same_password" || /different from (?:the )?(?:old|current) password|same password/i.test(error.message);
      setMessage(isSamePassword ? "Your new password must be different from your current password." : "Password could not be saved. Please try again or request a new link.");
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    if (flow === "recovery") { setIsResetComplete(true); return; }
    router.replace("/"); router.refresh();
  }

  if (!hasChecked) return <ArtistDeckLoading />;
  const isRecovery = flow === "recovery";
  return <ArtistDeckSystemShell heading={isRecovery ? "Reset your password" : "Choose your password"}>
    {isInvalidLink ? <div className="auth-form-result"><p className="login-error" role="alert">{message}</p><Link className="auth-form-link" href="/forgot-password">Request another reset email</Link><Link className="auth-form-link" href="/login">Return to sign in</Link></div> : isResetComplete ? <div className="auth-form-result" role="status"><p>Password reset successfully. You can continue to ArtistDeck.</p><button className="login-submit" onClick={() => { router.replace("/"); router.refresh(); }} type="button">Continue to ArtistDeck</button></div> : !isReady || !flow ? <p className="login-error" role="alert">This link could not be verified. Request a fresh link and try again.</p> : <form className="login-form" onSubmit={submit}>
      {message ? <p className="login-error" role="alert">{message}</p> : null}
      <label>New password<input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label><label>Confirm new password<input autoComplete="new-password" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label>
      <button disabled={isSubmitting} type="submit">{isSubmitting ? <><LoaderCircle aria-hidden className="onboarding-spinner" size={16} /> {isRecovery ? "Resetting password…" : "Saving password…"}</> : isRecovery ? "Reset password" : "Save password"}</button>
    </form>}
  </ArtistDeckSystemShell>;
}
