"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [hasCheckedInvitation, setHasCheckedInvitation] = useState(false);
  const [isWorkspaceJoin, setIsWorkspaceJoin] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitationError, setInvitationError] = useState("");
  const [error, setError] = useState("");
  const acceptanceInFlight = useRef(false);
  const acceptanceComplete = useRef(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsReady(Boolean(session));
      if (session && !acceptanceComplete.current) void establishInvitationSession(session);
    });

    void establishInvitationSession();

    async function establishInvitationSession(existingSession?: { access_token: string } | null) {
      if (acceptanceInFlight.current || acceptanceComplete.current) return;
      const hashParameters = new URLSearchParams(window.location.hash.slice(1));
      const queryParameters = new URLSearchParams(window.location.search);
      const hashAccessToken = hashParameters.get("access_token");
      const refreshToken = hashParameters.get("refresh_token");
      const authorizationCode = queryParameters.get("code");
      const tokenHash = queryParameters.get("token_hash");
      const invitationType = queryParameters.get("type");
      const workspaceInvitation = queryParameters.get("workspace_invitation");
      const workspaceJoin = queryParameters.get("workspace_join") === "1";

      // createBrowserClient restores or exchanges an auth session asynchronously
      // when it is constructed. Wait for that initialization before attempting a
      // manual handoff so this page never treats an in-flight sign-in as invalid.
      const { data: initialSession } = await supabase.auth.getSession();
      let session = existingSession ?? initialSession.session;

      if (!session && hashAccessToken && refreshToken) {
        const { data } = await supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: refreshToken
        });
        session = data.session;
      } else if (!session && authorizationCode) {
        const { data } = await supabase.auth.exchangeCodeForSession(authorizationCode);
        session = data.session;
      } else if (!session && tokenHash && invitationType === "invite") {
        const { data } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite"
        });
      }

      if (session) {
        acceptanceInFlight.current = true;
        if (workspaceInvitation) {
          const response = await fetch("/api/invitations/accept", {
            body: JSON.stringify({ token: workspaceInvitation }),
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json"
            },
            method: "POST"
          });
          if (!response.ok) {
            setInvitationError(
              ((await response.json()) as { error?: string }).error || "Invitation could not be accepted."
            );
            setIsReady(true);
            setHasCheckedInvitation(true);
            acceptanceInFlight.current = false;
            return;
          }
        }
        acceptanceComplete.current = true;
        setIsWorkspaceJoin(workspaceJoin);
        window.history.replaceState({}, "", "/set-password");
        if (workspaceJoin) {
          window.location.assign("/");
          return;
        }
        acceptanceInFlight.current = false;
        setIsReady(true);
        setHasCheckedInvitation(true);
        return;
      }
      // Session restoration may complete after the initial getSession call.
      // Keep the loading state until the auth listener resumes this flow.
      setIsReady(false);
    }

    return () => listener.subscription.unsubscribe();
  }, [router]);

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
        <span aria-hidden className="login-logo login-logo-neutral">LS</span>
        <div>
          <p className="eyebrow">LS Dashboard</p>
          <h1 id="password-title">Choose your password</h1>
        </div>

        {!hasCheckedInvitation ? (
          <p>Checking invitation...</p>
        ) : invitationError ? (
          <p className="login-error" role="alert">{invitationError}</p>
        ) : !isReady ? (
          <p className="login-error" role="alert">
            This invitation could not be verified. Request a fresh invitation and
            open its link only once.
          </p>
        ) : isWorkspaceJoin ? (
          <p>Joining workspace...</p>
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
