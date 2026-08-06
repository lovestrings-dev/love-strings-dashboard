"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [hasCheckedInvitation, setHasCheckedInvitation] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsReady(Boolean(session));
    });

    void establishInvitationSession();

    async function establishInvitationSession() {
      const hashParameters = new URLSearchParams(window.location.hash.slice(1));
      const queryParameters = new URLSearchParams(window.location.search);
      const accessToken = hashParameters.get("access_token");
      const refreshToken = hashParameters.get("refresh_token");
      const authorizationCode = queryParameters.get("code");
      const tokenHash = queryParameters.get("token_hash");
      const invitationType = queryParameters.get("type");

      let sessionEstablished = false;

      if (accessToken && refreshToken) {
        const { data } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        sessionEstablished = Boolean(data.session);
      } else if (authorizationCode) {
        const { data } = await supabase.auth.exchangeCodeForSession(authorizationCode);
        sessionEstablished = Boolean(data.session);
      } else if (tokenHash && invitationType === "invite") {
        const { data } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite"
        });
        sessionEstablished = Boolean(data.session);
      } else {
        const { data } = await supabase.auth.getSession();
        sessionEstablished = Boolean(data.session);
      }

      if (sessionEstablished) {
        window.history.replaceState({}, "", "/set-password");
      }

      setIsReady(sessionEstablished);
      setHasCheckedInvitation(true);
    }

    return () => listener.subscription.unsubscribe();
  }, []);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({
      password
    });

    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="password-title">
        <Image
          alt="Love Strings"
          className="login-logo"
          height={72}
          priority
          src="/love-strings-logo.jpeg"
          width={72}
        />
        <div>
          <p className="eyebrow">Individual account</p>
          <h1 id="password-title">Choose your password</h1>
        </div>

        {!hasCheckedInvitation ? (
          <p>Checking invitation...</p>
        ) : !isReady ? (
          <p className="login-error" role="alert">
            This invitation could not be verified. Request a fresh invitation and
            open its link only once.
          </p>
        ) : (
          <form className="login-form" onSubmit={savePassword}>
            <label>
              New password
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label>
              Confirm password
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </label>
            {error ? <p className="login-error" role="alert">{error}</p> : null}
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : "Save password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
