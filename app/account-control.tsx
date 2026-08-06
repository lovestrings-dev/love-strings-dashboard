"use client";

import { Info, LogOut, Settings, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function AccountControl({
  onOpenUserSettings
}: {
  onOpenUserSettings: () => void;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Account");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const accountControlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function loadAccount() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        return;
      }

      const { data: profile } = await supabase
        .from("app_profiles")
        .select("avatar_path, display_name")
        .eq("id", user.id)
        .maybeSingle();
      const profileName = profile?.display_name;
      const metadataName = user.user_metadata.display_name;
      const fallbackName = user.email?.split("@")[0] ?? "Account";
      setDisplayName(
        typeof profileName === "string" && profileName.trim()
          ? profileName.trim()
          : typeof metadataName === "string" && metadataName.trim()
          ? metadataName.trim()
          : fallbackName
      );
      setEmail(user.email ?? "");
      if (profile?.avatar_path) {
        const { data: avatarData } = await supabase.storage
          .from("avatars")
          .createSignedUrl(profile.avatar_path, 60 * 60);
        setAvatarUrl(avatarData?.signedUrl ?? "");
      }
    }

    function refreshDisplayName(event: Event) {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      if (typeof event.detail === "string") {
        setDisplayName(event.detail);
        return;
      }

      if (event.detail && typeof event.detail === "object") {
        const detail = event.detail as {
          avatarUrl?: string;
          displayName?: string;
        };
        if (typeof detail.displayName === "string") {
          setDisplayName(detail.displayName);
        }
        if (typeof detail.avatarUrl === "string") {
          setAvatarUrl(detail.avatarUrl);
        }
      }
    }

    void loadAccount();
    window.addEventListener("love-strings-profile-updated", refreshDisplayName);

    return () => {
      window.removeEventListener("love-strings-profile-updated", refreshDisplayName);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function closeMenu(event: MouseEvent | TouchEvent) {
      if (
        event.target instanceof Node &&
        !accountControlRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    function closeMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("touchstart", closeMenu);
    document.addEventListener("keydown", closeMenuWithKeyboard);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("touchstart", closeMenu);
      document.removeEventListener("keydown", closeMenuWithKeyboard);
    };
  }, [isMenuOpen]);

  async function signOut() {
    setIsSigningOut(true);
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div
      className="account-control"
      ref={accountControlRef}
      title={email || displayName}
    >
      <div className="account-identity">
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label={`Open settings for ${displayName}`}
          className={`account-avatar${avatarUrl ? " has-image" : ""}`}
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          style={avatarUrl ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` } : undefined}
          type="button"
        >
          {avatarUrl ? null : displayName.slice(0, 1).toUpperCase()}
        </button>
        <span className="account-name">Hi, {displayName}</span>
      </div>
      {isMenuOpen ? (
        <div className="account-menu" role="menu">
          <button
            onClick={() => {
              setIsMenuOpen(false);
              onOpenUserSettings();
            }}
            role="menuitem"
            type="button"
          >
            <UserRound aria-hidden size={17} />
            <span>User settings</span>
          </button>
          <button role="menuitem" type="button">
            <Settings aria-hidden size={17} />
            <span>General Settings</span>
          </button>
          <button role="menuitem" type="button">
            <Info aria-hidden size={17} />
            <span>About Dashboard</span>
          </button>
          <button
            aria-label={isSigningOut ? "Signing out" : `Sign out ${displayName}`}
            className="account-menu-sign-out"
            disabled={isSigningOut}
            onClick={signOut}
            role="menuitem"
            type="button"
          >
            <LogOut aria-hidden size={17} />
            <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
