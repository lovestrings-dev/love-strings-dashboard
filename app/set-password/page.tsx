"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LoaderCircle } from "lucide-react";
import { ArtistDeckLoading, ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { callbackNeedsPassword, currentAuthCallback } from "@/lib/auth-callback";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false); const [hasChecked, setHasChecked] = useState(false);
  const [isReady, setIsReady] = useState(false); const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const complete = useRef(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    void establish();
    async function establish() {
      if (complete.current) return;
      const query = new URLSearchParams(window.location.search), hash = new URLSearchParams(window.location.hash.slice(1));
      const callback = currentAuthCallback(query, hash);
      const ordinary = query.get("workspace_invitation");
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
        if (!response.ok) { setMessage(((await response.json()) as { error?: string }).error || "Invitation could not be accepted."); setIsReady(true); setHasChecked(true); return; }
      }
      complete.current = true;
      window.history.replaceState({}, "", "/set-password");
      if (!callbackNeedsPassword(callback)) { window.location.assign("/"); return; }
      setNeedsPassword(true);
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
    setIsSubmitting(true); const supabase = createBrowserSupabaseClient();
    if (needsPassword) {
      const { error } = await supabase.auth.updateUser({ password }); if (error) { setMessage(error.message); setIsSubmitting(false); return; }
    }
    router.replace("/"); router.refresh();
  }

  if (!hasChecked) return <ArtistDeckLoading />;
  return <ArtistDeckSystemShell heading="Choose your password">
    {message ? <p className="login-error" role="alert">{message}</p> : !isReady ? <p className="login-error" role="alert">This invitation could not be verified. Request a fresh invitation and open its link only once.</p> : <form className="login-form" onSubmit={submit}>
      {needsPassword ? <><label>New password<input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label><label>Confirm password<input autoComplete="new-password" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label></> : null}
      <button disabled={isSubmitting} type="submit">{isSubmitting ? <><LoaderCircle aria-hidden className="onboarding-spinner" size={16} /> Saving password…</> : "Save password"}</button>
    </form>}
  </ArtistDeckSystemShell>;
}
