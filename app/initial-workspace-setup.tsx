"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";

export function InitialWorkspaceSetup({ initialUserName, onComplete }: { initialUserName: string; onComplete: (workspaceName: string) => void }) {
  const [userName, setUserName] = useState(initialUserName);
  const [artistBandName, setArtistBandName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setSubmitting(true);
    try {
      const response = await fetch("/api/workspace/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artistBandName, userName }) });
      const payload = await response.json() as { error?: string; workspace?: { workspace_name?: string } };
      if (!response.ok) throw new Error(payload.error || "Workspace setup could not be completed.");
      onComplete(payload.workspace?.workspace_name || artistBandName.trim());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Workspace setup could not be completed."); } finally { setSubmitting(false); }
  }

  return <ArtistDeckSystemShell description="Tell us who you are and what this workspace is for." heading="Set up your ArtistDeck workspace"><form className="login-form" onSubmit={submit}><label>User Name<input autoComplete="name" disabled={submitting} maxLength={120} onChange={(event) => setUserName(event.target.value)} required value={userName} /></label><label>Artist / Band Name<input autoComplete="organization" disabled={submitting} maxLength={120} minLength={2} onChange={(event) => setArtistBandName(event.target.value)} required value={artistBandName} /></label>{message ? <p className="login-error" role="alert">{message}</p> : null}<button disabled={submitting} type="submit">{submitting ? <><LoaderCircle aria-hidden className="onboarding-spinner" size={16} /> Setting up your workspace…</> : "Open Dashboard"}</button></form></ArtistDeckSystemShell>;
}
