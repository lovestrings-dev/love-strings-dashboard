"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { ArtistDeckSystemShell } from "@/app/artistdeck-system-shell";

type ReleaseFrequency = "twice_monthly" | "monthly" | "undecided";
type DistributorAnswer = "yes" | "no" | "unknown";

export function InitialWorkspaceSetup({ initialUserName, onComplete }: { initialUserName: string; onComplete: (workspaceName: string) => void }) {
  const [userName, setUserName] = useState(initialUserName);
  const [artistBandName, setArtistBandName] = useState("");
  const [releaseFrequency, setReleaseFrequency] = useState<ReleaseFrequency | "">("");
  const [distributorAnswer, setDistributorAnswer] = useState<DistributorAnswer | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectionsComplete = releaseFrequency !== "" && distributorAnswer !== "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectionsComplete) {
      setMessage("Choose both your release cadence and distributor answer before continuing.");
      return;
    }
    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/workspace/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artistBandName, distributorAnswer, releaseFrequency, userName }) });
      const payload = await response.json() as { error?: string; workspace?: { workspace_name?: string } };
      if (!response.ok) throw new Error(payload.error || "Workspace setup could not be completed.");
      onComplete(payload.workspace?.workspace_name || artistBandName.trim());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace setup could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return <ArtistDeckSystemShell cardClassName="initial-workspace-setup-card" description="Choose the two workspace defaults that shape your first song. You can refine them later in Settings." heading="Set up your ArtistDeck workspace"><form className="login-form initial-workspace-setup-form" onSubmit={submit}><label>User Name<input autoComplete="name" disabled={submitting} maxLength={120} onChange={(event) => setUserName(event.target.value)} required value={userName} /></label><label>Artist / Band Name<input autoComplete="organization" disabled={submitting} maxLength={120} minLength={2} onChange={(event) => setArtistBandName(event.target.value)} required value={artistBandName} /></label><fieldset className={`initial-workspace-setup-choice${releaseFrequency ? " is-selected" : ""}`}><legend>How often do you plan to release songs?</legend><p>Choose the timing for your first release plan.</p><select aria-describedby="release-frequency-help" disabled={submitting} onChange={(event) => setReleaseFrequency(event.target.value as ReleaseFrequency)} required value={releaseFrequency}><option disabled value="">Choose release cadence</option><option value="twice_monthly">Twice a month</option><option value="monthly">Once a month</option><option value="undecided">I don’t know yet</option></select><small id="release-frequency-help">This sets a 14- or 28-day first-song production window.</small></fieldset><fieldset className={`initial-workspace-setup-choice${distributorAnswer ? " is-selected" : ""}`}><legend>Do you already have a Distributor for your music?</legend><p>Choose the workflow that applies to your first song.</p><select aria-describedby="distributor-answer-help" disabled={submitting} onChange={(event) => setDistributorAnswer(event.target.value as DistributorAnswer)} required value={distributorAnswer}><option disabled value="">Choose distributor answer</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">I don’t know</option></select><small id="distributor-answer-help">Yes adds the configured Distributor deadline and cost; No and I don’t know leave it off.</small></fieldset>{message ? <p className="login-error" role="alert">{message}</p> : null}<button aria-disabled={!selectionsComplete || submitting} disabled={!selectionsComplete || submitting} type="submit">{submitting ? <><LoaderCircle aria-hidden className="onboarding-spinner" size={16} /> Setting up your workspace…</> : "Open Dashboard"}</button><p className="initial-workspace-setup-required">Both choices are required to continue.</p></form></ArtistDeckSystemShell>;
}
