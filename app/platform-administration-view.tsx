"use client";

import { ChevronDown, ChevronUp, LogOut, Mail, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type RefreshStatus = { message: string; state: "error" | "idle" | "loading" | "success" };
type PlatformWorkspace = { access_state: "active" | "frozen"; admin: { displayName: string; hasAvatar: boolean; role: string } | null; connectedServices: { googleYoutube: boolean; instagramCreator: boolean }; created_at: string; id: string; name: string; onboarding: { completed: number; total: number; steps: boolean[] }; pendingAdminEmail: string | null; settings: { distributorAnswer: string | null; hasLogo: boolean; releaseFrequency: string | null }; setup_state: "active" | "pending_setup"; slug: string; statistics: "configured" | "unknown" };
type DefaultTemplate = { card_order: string[]; template_key: string; theme: "dark" | "light"; version: number; visible_cards: string[] };

export function PlatformAdministrationView({ activeSection, onBack, showBack = false }: { activeSection: string; onBack: () => void; showBack?: boolean }) {
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);
  const [canCreateWorkspaces, setCanCreateWorkspaces] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState("");
  const [administratorEmail, setAdministratorEmail] = useState("");
  const [workspaces, setWorkspaces] = useState<PlatformWorkspace[]>([]);
  const [defaultTemplate, setDefaultTemplate] = useState<DefaultTemplate | null>(null);
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatformWorkspace | null>(null);
  const [accessTarget, setAccessTarget] = useState<{ action: "freeze" | "reactivate"; workspace: PlatformWorkspace } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [inviteStatus, setInviteStatus] = useState<RefreshStatus>({ message: "", state: "idle" });
  const [status, setStatus] = useState<RefreshStatus>({ message: "", state: "idle" });

  useEffect(() => {
    let isCancelled = false;
    void fetch("/api/platform/workspaces", { cache: "no-store" })
      .then(async (accessResponse) => ({ ok: accessResponse.ok, payload: await accessResponse.json() }))
      .then((access) => {
        if (isCancelled) return;
        setCanCreateWorkspaces(access.ok && access.payload.canCreateWorkspaces === true);
        if (access.ok && Array.isArray(access.payload.workspaces)) { setWorkspaces(access.payload.workspaces); setDefaultTemplate(access.payload.onboardingDefaults ?? null); }
        setAccessChecked(true);
      })
      .catch(() => {
        if (!isCancelled) setAccessChecked(true);
      });
    return () => { isCancelled = true; };
  }, []);

  async function refreshWorkspaces() {
    const response = await fetch("/api/platform/workspaces", { cache: "no-store" });
    const payload = await response.json() as { onboardingDefaults?: DefaultTemplate; workspaces?: PlatformWorkspace[] };
    if (response.ok && Array.isArray(payload.workspaces)) { setWorkspaces(payload.workspaces); setDefaultTemplate(payload.onboardingDefaults ?? null); }
  }

  async function inviteAdministrator(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setInviteStatus({ message: "Sending invitation...", state: "loading" });
    try {
      const response = await fetch("/api/platform/workspaces/invite-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: administratorEmail }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Invitation could not be sent.");
      setAdministratorEmail(""); await refreshWorkspaces(); setInviteStatus({ message: "Workspace Admin invitation sent.", state: "success" });
    } catch (error) { setInviteStatus({ message: error instanceof Error ? error.message : "Invitation could not be sent.", state: "error" }); }
  }

  async function deleteWorkspace() {
    if (!deleteTarget) return;
    setStatus({ message: "Deleting workspace...", state: "loading" });
    try {
      const response = await fetch(`/api/platform/workspaces/${deleteTarget.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteTarget.setup_state === "active" ? { confirmName: deleteConfirmation } : { confirmed: true })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Workspace deletion failed.");
      setDeleteTarget(null); setDeleteConfirmation(""); await refreshWorkspaces(); setStatus({ message: "Workspace permanently deleted.", state: "success" });
    } catch (error) { setStatus({ message: error instanceof Error ? error.message : "Workspace deletion failed.", state: "error" }); }
  }
  async function changeWorkspaceAccess(workspace: PlatformWorkspace, action: "freeze" | "reactivate") {
    setStatus({ message: action === "freeze" ? "Freezing workspace..." : "Reactivating workspace...", state: "loading" });
    try {
      const response = await fetch(`/api/platform/workspaces/${workspace.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirmed: true }) });
      const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "Workspace action failed.");
      setAccessTarget(null); await refreshWorkspaces(); setStatus({ message: action === "freeze" ? "Workspace frozen. Members cannot access it until reactivated." : "Workspace reactivated.", state: "success" });
    } catch (error) { setStatus({ message: error instanceof Error ? error.message : "Workspace action failed.", state: "error" }); }
  }
  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ message: "Creating workspace...", state: "loading" });
    try {
      const response = await fetch("/api/platform/workspaces", {
        body: JSON.stringify({ name: newWorkspaceName, slug: newWorkspaceSlug }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string; name?: string };
      if (!response.ok) throw new Error(payload.error || "Workspace creation failed.");
      setNewWorkspaceName("");
      setNewWorkspaceSlug("");
      setStatus({ message: `${payload.name || "Workspace"} is ready for onboarding.`, state: "success" });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "Workspace creation failed.", state: "error" });
    }
  }

  async function signOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="platform-admin-canvas" aria-labelledby="platform-administration-title">
      <header className="platform-admin-header">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1 id="platform-administration-title">Workspace provisioning</h1>
        </div>
        <div className="platform-admin-header-actions">
          <button className="platform-admin-logout" onClick={() => void signOut()} type="button"><LogOut aria-hidden size={16} /> Logout</button>
        </div>
      </header>
      <div className="platform-admin-content">
        {accessChecked && !canCreateWorkspaces ? <article className="platform-admin-card"><h2>Platform access required</h2><p>Only registered platform operators can provision workspaces.</p></article> : null}
        {canCreateWorkspaces ? <article className="platform-admin-card platform-admin-primary">
          <div className="general-settings-heading"><div><p className="eyebrow">External onboarding</p><h2>Invite new workspace admin</h2></div></div>
          <p className="settings-description">Send one future administrator an ArtistDeck setup link. Their Artist/Band Name is collected privately during onboarding.</p>
          <form className="workspace-invitation-form" onSubmit={inviteAdministrator}>
            <label><span>Administrator email</span><input disabled={inviteStatus.state === "loading"} onChange={(event) => setAdministratorEmail(event.target.value)} placeholder="admin@example.com" required type="email" value={administratorEmail} /></label>
            <button disabled={inviteStatus.state === "loading"} type="submit"><Mail aria-hidden size={16} /><span>{inviteStatus.state === "loading" ? "Sending..." : "Invite admin"}</span></button>
          </form>
          {inviteStatus.message ? <p className={inviteStatus.state === "error" ? "settings-error" : "settings-status"}>{inviteStatus.message}</p> : null}
        </article> : null}
        {canCreateWorkspaces ? <article className="platform-admin-card">
          <div className="general-settings-heading"><div><p className="eyebrow">Workspace management</p><h2>Workspaces</h2></div></div>
          <p className="settings-description">Deletion is permanent. A provisional workspace stops its pending invitation; an active workspace requires its exact name.</p>
          {workspaces.length ? <div className="platform-workspace-list">{workspaces.map((workspace) => <Fragment key={workspace.id}><article className="platform-workspace-row"><div><strong>{workspace.name}</strong><span><b className={`platform-state platform-state-${workspace.access_state}`}>{workspace.access_state === "frozen" ? "Frozen" : workspace.setup_state === "pending_setup" ? "Pending setup" : "Active"}</b> · Slug: {workspace.slug}</span><div className="platform-workspace-facts"><span>Admin: {workspace.admin?.displayName ?? workspace.pendingAdminEmail ?? "Awaiting administrator"}</span><span>Onboarding: {workspace.onboarding.completed}/{workspace.onboarding.total} complete</span><span>Services: Google/YouTube {workspace.connectedServices.googleYoutube ? "connected" : "not connected"} · Instagram Creator {workspace.connectedServices.instagramCreator ? "connected" : "not connected"}</span><span>Statistics: {workspace.statistics}</span></div></div><div className="platform-workspace-actions">{workspace.access_state === "frozen" ? <button className="platform-reactivate-button" disabled={status.state === "loading"} onClick={() => setAccessTarget({ action: "reactivate", workspace })} type="button">Reactivate</button> : workspace.setup_state === "active" ? <button className="platform-freeze-button" disabled={status.state === "loading"} onClick={() => setAccessTarget({ action: "freeze", workspace })} type="button">Freeze</button> : null}<button className="platform-delete-button" disabled={status.state === "loading"} onClick={() => { setDeleteTarget(workspace); setDeleteConfirmation(""); }} type="button"><Trash2 aria-hidden size={15} /> Delete</button></div></article>{accessTarget?.workspace.id === workspace.id ? <div className="platform-access-confirmation"><strong>{accessTarget.action === "freeze" ? `Freeze “${workspace.name}”?` : `Reactivate “${workspace.name}”?`}</strong><p>{accessTarget.action === "freeze" ? "Members will not be able to open this workspace until you reactivate it. Its data and memberships stay unchanged." : "Members will be able to use this workspace again."}</p><div><button onClick={() => setAccessTarget(null)} type="button">Cancel</button><button className={accessTarget.action === "freeze" ? "platform-freeze-button" : "platform-reactivate-button"} disabled={status.state === "loading"} onClick={() => void changeWorkspaceAccess(accessTarget.workspace, accessTarget.action)} type="button">{accessTarget.action === "freeze" ? "Confirm freeze" : "Confirm reactivation"}</button></div></div> : null}</Fragment>)}</div> : <p className="settings-description">No workspaces available.</p>}
          {deleteTarget ? <div className="platform-delete-confirmation"><strong>{deleteTarget.setup_state === "pending_setup" ? "Delete provisional workspace?" : `Delete “${deleteTarget.name}”?`}</strong><p>{deleteTarget.setup_state === "pending_setup" ? "Its invitation/access will stop and the workspace will be permanently removed." : "This permanently removes this workspace and its data. Type its exact name to continue."}</p>{deleteTarget.setup_state === "active" ? <input aria-label="Exact workspace name" onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={deleteTarget.name} value={deleteConfirmation} /> : null}<div><button onClick={() => { setDeleteTarget(null); setDeleteConfirmation(""); }} type="button">Cancel</button><button className="platform-delete-button" disabled={status.state === "loading" || (deleteTarget.setup_state === "active" && deleteConfirmation !== deleteTarget.name)} onClick={() => void deleteWorkspace()} type="button">Delete permanently</button></div></div> : null}
        </article> : null}
        {canCreateWorkspaces ? <article className="platform-admin-card">
          <div className="platform-guidance-heading"><div><p className="eyebrow">Defaults</p><h2>Onboarding &amp; Guidance Defaults</h2><p>Current new-member dashboard template: <b>{defaultTemplate ? `${defaultTemplate.template_key} v${defaultTemplate.version}` : "Loading..."}</b>{defaultTemplate ? ` · ${defaultTemplate.theme} theme · ${defaultTemplate.visible_cards.length} visible of ${defaultTemplate.card_order.length} cards` : ""}</p></div><button aria-expanded={isGuidanceOpen} aria-label="Toggle onboarding guidance defaults" className="settings-disclosure-button" onClick={() => setIsGuidanceOpen((current) => !current)} type="button">{isGuidanceOpen ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}</button></div>
          {isGuidanceOpen ? <div className="platform-guidance-recap"><p><b>Release frequency:</b> twice monthly = 14-day cadence/window; monthly = 28-day cadence/window; undecided operates as monthly.</p><p><b>Distributor:</b> Yes enables a 14-day lead and €10 cost; No or unknown leaves it disabled.</p><p><b>Marketing:</b> twice monthly uses 7 campaign days / 2 days before release; monthly uses 14 / 3.</p><p><b>First song:</b> “My Song Name”; Auto Plan “My Album Name”, 12 months; the first release is release-window, later releases follow cadence.</p><p className="settings-description">Feature rollout controls are intentionally a placeholder; this card is informational only.</p></div> : null}
        </article> : null}
        {canCreateWorkspaces ? <article className="platform-admin-card platform-admin-internal">
          <div className="general-settings-heading"><div><p className="eyebrow">Internal tool</p><h2>Direct workspace creation</h2></div></div>
          <p className="settings-description">For internal operator use only. Use the invitation flow above for external workspace administrators.</p>
          <form className="workspace-invitation-form" onSubmit={createWorkspace}>
            <label><span>Name</span><input disabled={status.state === "loading"} onChange={(event) => setNewWorkspaceName(event.target.value)} placeholder="Test Band" required value={newWorkspaceName} /></label>
            <label><span>Slug</span><input disabled={status.state === "loading"} onChange={(event) => setNewWorkspaceSlug(event.target.value)} placeholder="test-band" required value={newWorkspaceSlug} /></label>
            <button disabled={status.state === "loading"} type="submit"><Plus aria-hidden size={16} /><span>{status.state === "loading" ? "Creating..." : "Create workspace"}</span></button>
          </form>
          {status.message ? <p className={status.state === "error" ? "settings-error" : "settings-status"}>{status.message}</p> : null}
        </article> : null}
      </div>
    </section>
  );
}
