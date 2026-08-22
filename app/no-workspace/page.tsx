"use client";

import { useRouter } from "next/navigation";
import { ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function NoWorkspacePage() {
  const router = useRouter();
  async function signOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <ArtistDeckSystemShell description="Your account has not been invited to a workspace. Ask a workspace administrator to send you an invitation." heading="No workspace access yet">
        <button className="login-submit" onClick={() => void signOut()} type="button">
          Sign out
        </button>
    </ArtistDeckSystemShell>
  );
}
