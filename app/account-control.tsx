"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function AccountControl() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className="account-sign-out"
      disabled={isSigningOut}
      onClick={signOut}
      title="Sign out"
      type="button"
    >
      <LogOut aria-hidden size={16} />
      <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}
