"use client";

import { ChevronDown, Info, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function AccountControl({
  guidanceContext,
  onGuidanceAbandon,
  onGuidanceMenuOpen,
  onOpenAboutDashboard,
  onOpenGeneralSettings,
  onOpenPlatformAdministration,
  onOpenUserSettings,
  onReady,
  workspaceLogoUrl,
  workspaceName
}: {
  guidanceContext: "none" | "add-song" | "song-settings" | "google-logo" | "google-settings" | "invite-member";
  onGuidanceAbandon: () => void;
  onGuidanceMenuOpen: () => void;
  onOpenAboutDashboard: () => void;
  onOpenGeneralSettings: () => void;
  onOpenPlatformAdministration: () => void;
  onOpenUserSettings: () => void;
  onReady: () => void;
  workspaceLogoUrl: string;
  workspaceName: string;
}) {
  const router = useRouter();
  // Branding is optional. The app mark is a visual fallback only; it is never
  // written as a workspace asset and a real uploaded logo always wins.
  const resolvedWorkspaceLogoUrl = workspaceLogoUrl || "/artistdeck-logo.png";
  const [displayName, setDisplayName] = useState("Account");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [workspaceRole, setWorkspaceRole] = useState<
    "admin" | "member" | "viewer" | null
  >(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [isPlatformOperator, setIsPlatformOperator] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<{
    id: string;
    logoPath: string;
    name: string;
    role: "admin" | "member" | "viewer";
    slug: string;
  }>>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const accountControlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let isCancelled = false;

    async function loadAccount() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) return;

        const [profileResult, workspaceResult, workspacesResult, platformResult] = await Promise.all([
        supabase
          .from("app_profiles")
          .select("avatar_path, display_name")
          .eq("id", user.id)
          .maybeSingle(),
        fetch("/api/workspace/active", { cache: "no-store" }),
        fetch("/api/workspaces", { cache: "no-store" }),
        fetch("/api/platform/workspaces", { cache: "no-store" })
        ]);
        const profile = profileResult.data;
        const workspacePayload = (await workspaceResult.json().catch(() => null)) as {
        workspaceId?: string;
        role?: string;
        } | null;
        const workspaceListPayload = (await workspacesResult.json().catch(() => null)) as {
        workspaces?: typeof workspaces;
        } | null;
        if (workspacesResult.ok && Array.isArray(workspaceListPayload?.workspaces)) {
          setWorkspaces(workspaceListPayload.workspaces);
        }
        setIsPlatformOperator(platformResult.ok);
        setActiveWorkspaceId(workspaceResult.ok ? workspacePayload?.workspaceId ?? "" : "");
        const loadedRole = workspaceResult.ok ? workspacePayload?.role : null;
        setWorkspaceRole(
        loadedRole === "admin" ||
        loadedRole === "member" ||
        loadedRole === "viewer"
          ? loadedRole
          : null
        );
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
      } finally {
        if (!isCancelled) onReady();
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
      isCancelled = true;
      window.removeEventListener("love-strings-profile-updated", refreshDisplayName);
    };
  }, [onReady]);

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
        onGuidanceAbandon();
      }
    }

    function closeMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        onGuidanceAbandon();
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
  }, [isMenuOpen, onGuidanceAbandon]);

  async function signOut() {
    setIsSigningOut(true);
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function switchWorkspace(workspaceId: string) {
    if (!workspaceId || workspaceId === activeWorkspaceId) return;
    setIsSwitchingWorkspace(true);
    try {
      const response = await fetch("/api/workspaces", {
        body: JSON.stringify({ workspaceId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Workspace switch failed.");
      }
      // The active-workspace cookie is server-scoped. A hard reload makes every
      // workspace-scoped client snapshot re-resolve immediately after the write.
      window.location.reload();
    } catch (error) {
      console.error("Unable to switch workspace.", error);
      setIsSwitchingWorkspace(false);
    }
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
          aria-label={`Open workspace menu for ${workspaceName}`}
          className={`account-workspace-logo has-image${guidanceContext === "google-logo" ? " guidance-target-light" : ""}`}
          onClick={() => {
            const next = !isMenuOpen;
            setIsMenuOpen(next);
            if (next) onGuidanceMenuOpen();
          }}
          style={{ backgroundImage: `url(${JSON.stringify(resolvedWorkspaceLogoUrl)})` }}
          type="button"
        >
        </button>
        <span className="account-workspace-name"><strong>{workspaceName}</strong><span>ArtistDeck</span></span>
        <span
          aria-label={`${displayName} avatar`}
          className={`account-avatar${avatarUrl ? " has-image" : ""}`}
          role="img"
          style={avatarUrl ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` } : undefined}
        >
          {avatarUrl ? null : displayName.slice(0, 1).toUpperCase()}
        </span>
      </div>
      {isMenuOpen ? (
        <div className="account-menu" role="menu">
          {workspaces.length > 1 ? (
            <label className="workspace-selector">
              <span>Workspace</span>
              <span className="workspace-selector-control">
                <select
                  aria-label="Active workspace"
                  disabled={isSwitchingWorkspace}
                  onChange={(event) => void switchWorkspace(event.target.value)}
                  value={activeWorkspaceId}
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden size={15} />
              </span>
            </label>
          ) : null}
          <button
            onClick={() => {
              setIsMenuOpen(false);
              onGuidanceAbandon();
              onOpenUserSettings();
            }}
            role="menuitem"
            type="button"
          >
            <UserRound aria-hidden size={17} />
            <span>User settings</span>
          </button>
          {workspaceRole === "admin" ? (
            <button
              className={guidanceContext === "google-settings" ? "guidance-target-light guidance-menu-settings" : undefined}
              onClick={() => {
                setIsMenuOpen(false);
                onOpenGeneralSettings();
              }}
              role="menuitem"
              type="button"
            >
              <Settings aria-hidden size={17} />
              <span>General Settings</span>
            </button>
          ) : null}
          {isPlatformOperator ? (
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onGuidanceAbandon();
                onOpenPlatformAdministration();
              }}
              role="menuitem"
              type="button"
            >
              <ShieldCheck aria-hidden size={17} />
              <span>Platform administration</span>
            </button>
          ) : null}
          <button
            onClick={() => {
              setIsMenuOpen(false);
              onGuidanceAbandon();
              onOpenAboutDashboard();
            }}
            role="menuitem"
            type="button"
          >
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
