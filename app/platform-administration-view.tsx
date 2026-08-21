"use client";

import { Mail, Plus, RotateCw, ShieldBan, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type RefreshStatus = { message: string; state: "error" | "idle" | "loading" | "success" };
type ProvisioningInvitation = { acceptedAt: string | null; createdAt: string; email: string; expiresAt: string; id: string; status: "accepted" | "expired" | "pending" | "revoked"; workspaceName: string | null };
type PlatformWorkspace = { created_at: string; id: string; name: string; pendingAdminEmail: string | null; setup_state: "active" | "pending_setup"; slug: string };

export function PlatformAdministrationView({ activeSection, onBack, showBack = false }: { activeSection: string; onBack: () => void; showBack?: boolean }) {
  const [accessChecked, setAccessChecked] = useState(false);
  const [canCreateWorkspaces, setCanCreateWorkspaces] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState("");
  const [administratorEmail, setAdministratorEmail] = useState("");
  const [invitations, setInvitations] = useState<ProvisioningInvitation[]>([]);
  const [workspaces, setWorkspaces] = useState<PlatformWorkspace[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PlatformWorkspace | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [inviteStatus, setInviteStatus] = useState<RefreshStatus>({ message: "", state: "idle" });
  const [status, setStatus] = useState<RefreshStatus>({ message: "", state: "idle" });

  useEffect(() => {
    let isCancelled = false;
    void Promise.all([fetch("/api/platform/workspaces", { cache: "no-store" }), fetch("/api/platform/provisioning-invitations", { cache: "no-store" })])
      .then(async ([accessResponse, invitationsResponse]) => ({ access: { ok: accessResponse.ok, payload: await accessResponse.json() }, invitations: { ok: invitationsResponse.ok, payload: await invitationsResponse.json() } }))
      .then(({ access, invitations: loaded }) => {
        if (isCancelled) return;
        setCanCreateWorkspaces(access.ok && access.payload.canCreateWorkspaces === true);
        if (access.ok && Array.isArray(access.payload.workspaces)) setWorkspaces(access.payload.workspaces);
        if (loaded.ok && Array.isArray(loaded.payload.invitations)) setInvitations(loaded.payload.invitations);
        setAccessChecked(true);
      })
      .catch(() => {
        if (!isCancelled) setAccessChecked(true);
      });
    return () => { isCancelled = true; };
  }, []);

  async function refreshWorkspaces() {
    const response = await fetch("/api/platform/workspaces", { cache: "no-store" });
    const payload = await response.json() as { workspaces?: PlatformWorkspace[] };
    if (response.ok && Array.isArray(payload.workspaces)) setWorkspaces(payload.workspaces);
  }

  async function refreshInvitations() {
    const response = await fetch("/api/platform/provisioning-invitations", { cache: "no-store" });
    const payload = await response.json() as { invitations?: ProvisioningInvitation[] };
    if (response.ok && Array.isArray(payload.invitations)) setInvitations(payload.invitations);
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
  async function updateInvitation(id: string, action: "resend" | "revoke") {
    setInviteStatus({ message: action === "resend" ? "Resending invitation..." : "Revoking invitation...", state: "loading" });
    try {
      const response = await fetch("/api/platform/provisioning-invitations", { method: action === "resend" ? "PATCH" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "resend" ? { action, invitationId: id } : { invitationId: id }) });
      const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "Invitation could not be updated.");
      await refreshInvitations(); setInviteStatus({ message: action === "resend" ? "Fresh invitation email sent." : "Invitation revoked.", state: "success" });
    } catch (error) { setInviteStatus({ message: error instanceof Error ? error.message : "Invitation could not be updated.", state: "error" }); }
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

  return (
    <section className="user-settings-canvas" aria-labelledby="platform-administration-title">
      <header className="user-settings-header">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1 id="platform-administration-title">Workspace provisioning</h1>
        </div>
        {showBack ? <button onClick={onBack} type="button">Back to {activeSection}</button> : null}
      </header>
      <div className="user-settings-content">
        {accessChecked && !canCreateWorkspaces ? <article className="general-settings-card"><h2>Platform access required</h2><p>Only registered platform operators can provision workspaces.</p></article> : null}
        {canCreateWorkspaces ? <article className="general-settings-card general-settings-invitations">
          <div className="general-settings-heading"><div><p className="eyebrow">External onboarding</p><h2>Invite new workspace admin</h2></div></div>
          <p className="settings-description">Send one future administrator an ArtistDeck setup link. Their Artist/Band Name is collected privately during onboarding.</p>
          <form className="workspace-invitation-form" onSubmit={inviteAdministrator}>
            <label><span>Administrator email</span><input disabled={inviteStatus.state === "loading"} onChange={(event) => setAdministratorEmail(event.target.value)} placeholder="admin@example.com" required type="email" value={administratorEmail} /></label>
            <button disabled={inviteStatus.state === "loading"} type="submit"><Mail aria-hidden size={16} /><span>{inviteStatus.state === "loading" ? "Sending..." : "Invite new workspace admin"}</span></button>
          </form>
          {inviteStatus.message ? <p className={inviteStatus.state === "error" ? "settings-error" : "settings-status"}>{inviteStatus.message}</p> : null}
        </article> : null}
        {canCreateWorkspaces ? <article className="general-settings-card general-settings-invitations">
          <div className="general-settings-heading"><div><p className="eyebrow">Workspace controls</p><h2>Delete workspace</h2></div></div>
          <p className="settings-description">Deletion is permanent. A provisional workspace stops its pending invitation; an active workspace requires its exact name.</p>
          {workspaces.length ? <div className="settings-member-list">{workspaces.map((workspace) => <article className="settings-member-row" key={workspace.id}><div><strong>{workspace.name}</strong><span>{workspace.setup_state === "pending_setup" ? `Pending setup${workspace.pendingAdminEmail ? ` · Admin: ${workspace.pendingAdminEmail}` : ""}` : `Active · ${workspace.slug}`}</span></div><div className="settings-member-actions"><button disabled={status.state === "loading"} onClick={() => { setDeleteTarget(workspace); setDeleteConfirmation(""); }} type="button"><Trash2 aria-hidden size={15} /> Delete</button></div></article>)}</div> : <p className="settings-description">No workspaces available.</p>}
          {deleteTarget ? <div className="settings-description"><strong>{deleteTarget.setup_state === "pending_setup" ? "Delete provisional workspace?" : `Delete “${deleteTarget.name}”?`}</strong><p>{deleteTarget.setup_state === "pending_setup" ? "Its invitation/access will stop and the workspace will be permanently removed." : "This permanently removes this workspace and its data. Type its exact name to continue."}</p>{deleteTarget.setup_state === "active" ? <input aria-label="Exact workspace name" onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={deleteTarget.name} value={deleteConfirmation} /> : null}<div className="settings-member-actions"><button onClick={() => { setDeleteTarget(null); setDeleteConfirmation(""); }} type="button">Cancel</button><button disabled={status.state === "loading" || (deleteTarget.setup_state === "active" && deleteConfirmation !== deleteTarget.name)} onClick={() => void deleteWorkspace()} type="button">Delete permanently</button></div></div> : null}
        </article> : null}
        {canCreateWorkspaces ? <article className="general-settings-card general-settings-invitations">
          <div className="general-settings-heading"><div><p className="eyebrow">Provisioning invitations</p><h2>Invitation lifecycle</h2></div></div>
          {invitations.length ? <div className="settings-member-list">{invitations.map((invitation) => <article className="settings-member-row" key={invitation.id}><div><strong>{invitation.email}</strong><span>{invitation.status === "accepted" ? `Accepted ${invitation.acceptedAt ? formatDate(invitation.acceptedAt) : ""}${invitation.workspaceName ? ` · ${invitation.workspaceName}` : ""}` : `${labelStatus(invitation.status)} · invited ${formatDate(invitation.createdAt)} · expires ${formatDate(invitation.expiresAt)}`}</span></div><div className="settings-member-actions">{(invitation.status === "pending" || invitation.status === "expired") ? <button aria-label="Resend invitation" disabled={inviteStatus.state === "loading"} onClick={() => void updateInvitation(invitation.id, "resend")} type="button"><RotateCw aria-hidden size={15} /> Resend</button> : null}{invitation.status === "pending" ? <button aria-label="Revoke invitation" disabled={inviteStatus.state === "loading"} onClick={() => void updateInvitation(invitation.id, "revoke")} type="button"><ShieldBan aria-hidden size={15} /> Revoke</button> : null}</div></article>)}</div> : <p className="settings-description">No provisioning invitations yet.</p>}
        </article> : null}
        {canCreateWorkspaces ? <article className="general-settings-card general-settings-invitations">
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

function labelStatus(status: ProvisioningInvitation["status"]) { return status.slice(0, 1).toUpperCase() + status.slice(1); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "unknown" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date); }
