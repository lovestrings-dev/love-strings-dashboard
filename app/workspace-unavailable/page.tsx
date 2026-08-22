"use client";

import { useRouter } from "next/navigation";
import { ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function WorkspaceUnavailablePage() {
  const router = useRouter();
  async function signOut() { await createBrowserSupabaseClient().auth.signOut(); router.replace("/login"); router.refresh(); }
  return <ArtistDeckSystemShell description="This workspace is currently inactive. Contact your administrator for access." heading="Workspace unavailable"><button className="login-submit" onClick={() => void signOut()} type="button">Sign out</button></ArtistDeckSystemShell>;
}
