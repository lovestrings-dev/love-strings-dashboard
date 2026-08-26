"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";

export function InitialWorkspaceSetup({ initialUserName, onComplete }: { initialUserName: string; onComplete: (workspaceName: string) => void }) {
  const [userName, setUserName] = useState(initialUserName);
  const [artistBandName, setArtistBandName] = useState("");
  const [releaseFrequency, setReleaseFrequency] = useState<"twice_monthly" | "monthly" | "undecided">("monthly");
  const [distributorAnswer, setDistributorAnswer] = useState<"yes" | "no" | "unknown">("no");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setSubmitting(true);
    try {
      const response = await fetch("/api/workspace/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artistBandName, distributorAnswer, releaseFrequency, userName }) });
      const payload = await response.json() as { error?: string; workspace?: { workspace_name?: string } };
      if (!response.ok) throw new Error(payload.error || "Workspace setup could not be completed.");
      onComplete(payload.workspace?.workspace_name || artistBandName.trim());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Workspace setup could not be completed."); } finally { setSubmitting(false); }
  }

  return <ArtistDeckSystemShell description="Tell us who you are and what this workspace is for." heading="Set up your ArtistDeck workspace"><form className="login-form" onSubmit={submit}><label>User Name<input autoComplete="name" disabled={submitting} maxLength={120} onChange={(event) => setUserName(event.target.value)} required value={userName} /></label><label>Artist / Band Name<input autoComplete="organization" disabled={submitting} maxLength={120} minLength={2} onChange={(event) => setArtistBandName(event.target.value)} required value={artistBandName} /></label><label>How often do you plan to release songs?<select disabled={submitting} onChange={(event) => setReleaseFrequency(event.target.value as "twice_monthly" | "monthly" | "undecided")} value={releaseFrequency}><option value="twice_monthly">Twice a month</option><option value="monthly">Once a month</option><option value="undecided">I don’t know yet</option></select></label><label>Do you already have a Distributor for your music?<select disabled={submitting} onChange={(event) => setDistributorAnswer(event.target.value as "yes" | "no" | "unknown")} value={distributorAnswer}><option value="yes">Yes</option><option value="no">No</option><option value="unknown">I don’t know</option></select></label>{message ? <p className="login-error" role="alert">{message}</p> : null}<button disabled={submitting} type="submit">{submitting ? <><LoaderCircle aria-hidden className="onboarding-spinner" size={16} /> Setting up your workspace…</> : "Open Dashboard"}</button></form></ArtistDeckSystemShell>;
}
