"use client";

import { darkModeFeatureProgram } from "@/lib/guidance";
import { ThemeSwitch, useAppearance } from "./appearance-provider";

/** Feature guidance applies to every member, independently of admin setup. */
export function DarkModeFeature({ eligible }: { eligible: boolean }) {
  const { ready, featureAcknowledged, saving, error, save } = useAppearance();
  if (!eligible || !ready || featureAcknowledged) return null;
  return <aside data-personal-appearance data-guidance-program={darkModeFeatureProgram.key} className="guidance-card feature-guidance" role="dialog" aria-modal="false" aria-labelledby="dark-mode-feature-title" aria-describedby="dark-mode-feature-description"><div><p className="eyebrow">New feature</p><h2 id="dark-mode-feature-title">{darkModeFeatureProgram.title}</h2></div><p id="dark-mode-feature-description">{darkModeFeatureProgram.description}</p><ThemeSwitch />{error ? <p role="alert">{error}</p> : null}<button className="guidance-close-button" type="button" disabled={saving} onClick={() => void save({ acknowledgeFeature: true })}>{saving ? "Saving…" : "Got it"}</button></aside>;
}
