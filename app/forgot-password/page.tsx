"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const redirectTo = new URL("/set-password?recovery=1", window.location.origin).toString();
      const { error } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
      // Authentication errors such as an unknown address must remain indistinguishable
      // from a successful request. Provider outages and throttling can be surfaced
      // without identifying whether the address has an account.
      if (error && (error.status === 429 || (error.status ?? 0) >= 500)) {
        setMessage(error.status === 429 ? "Too many reset requests. Please wait a moment and try again." : "Password reset is temporarily unavailable. Please try again later.");
        return;
      }
      setSubmitted(true);
    } catch {
      setMessage("Password reset is temporarily unavailable. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ArtistDeckSystemShell
      description="Enter your email address and we’ll send reset instructions if an account exists."
      heading="Reset your password"
    >
      {submitted ? (
        <div className="auth-form-result" role="status">
          <p>If an account exists for this email, password reset instructions have been sent.</p>
          <Link className="auth-form-link" href="/login">Return to sign in</Link>
        </div>
      ) : (
        <form className="login-form" onSubmit={requestReset}>
          <label>
            Email
            <input
              autoComplete="email"
              autoFocus
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          {message ? <p className="login-error" role="alert">{message}</p> : null}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Sending…" : "Send reset instructions"}
          </button>
          <Link className="auth-form-link" href="/login">Return to sign in</Link>
        </form>
      )}
    </ArtistDeckSystemShell>
  );
}
