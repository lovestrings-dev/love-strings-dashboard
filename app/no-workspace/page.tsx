"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function NoWorkspacePage() {
  const router = useRouter();
  const [canAccessPlatformAdministration, setCanAccessPlatformAdministration] = useState(false);

  useEffect(() => {
    void fetch("/api/platform/workspaces", { cache: "no-store" })
      .then((response) => setCanAccessPlatformAdministration(response.ok && !response.redirected))
      .catch(() => setCanAccessPlatformAdministration(false));
  }, []);

  async function signOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="no-workspace-title">
        <h1 id="no-workspace-title">No workspace access yet</h1>
        <p>
          Your account has not been invited to a workspace. Ask a workspace
          administrator to send you an invitation.
        </p>
        {canAccessPlatformAdministration ? <a className="login-submit" href="/platform">Open platform administration</a> : null}
        <button className="login-submit" onClick={() => void signOut()} type="button">
          Sign out
        </button>
      </section>
    </main>
  );
}
