"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArtistDeckLoading, ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (signInError) {
      setError("Email or password is incorrect.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (isSubmitting) return <ArtistDeckLoading />;

  return (
    <ArtistDeckSystemShell heading="Sign in">

        <form className="login-form" onSubmit={signIn}>
          <label>
            Email
            <input
              autoComplete="email"
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <Link className="auth-form-link auth-form-link-end" href="/forgot-password">
            Forgot password?
          </Link>
        </form>
    </ArtistDeckSystemShell>
  );
}
