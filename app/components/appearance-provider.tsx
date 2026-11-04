"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Theme } from "@/lib/appearance";

type Appearance = { theme: Theme; featureAcknowledged: boolean };
type AppearanceContext = Appearance & {
  ready: boolean; saving: boolean; error: string;
  save: (input: { theme?: Theme; acknowledgeFeature?: true }) => Promise<void>;
};
const Context = createContext<AppearanceContext | null>(null);

export function AppearanceProvider({ children, initialTheme }: { children: ReactNode; initialTheme: Theme }) {
  const pathname = usePathname();
  const [appearance, setAppearance] = useState<Appearance>({ theme: initialTheme, featureAcknowledged: false });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // No browser Auth client here: password callback parsing remains owned by
    // set-password, so appearance cannot consume a recovery/invitation token.
    const controller = new AbortController();
    fetch("/api/user/appearance", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setReady(false);
          if (response.status !== 401) setError("Appearance could not be loaded. Reload this page to try again.");
          return;
        }
        const loaded = await response.json() as Appearance;
        setAppearance(loaded);
        setError("");
        document.documentElement.dataset.theme = loaded.theme;
        setReady(true);
      }).catch(() => {
        if (!controller.signal.aborted) setError("Appearance could not be loaded. Reload this page to try again.");
      });
    return () => controller.abort();
  }, [pathname]);

  const save = useCallback(async (input: { theme?: Theme; acknowledgeFeature?: true }) => {
    if (saving) return;
    setSaving(true);
    setError("");
    const previous = appearance;
    if (input.theme) {
      setAppearance((current) => ({ ...current, theme: input.theme! }));
      document.documentElement.dataset.theme = input.theme;
    }
    try {
      const response = await fetch("/api/user/appearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-love-strings-dashboard": "write" },
        body: JSON.stringify(input)
      });
      if (!response.ok) throw new Error("Your choice could not be saved. Please try again.");
      const loaded = await response.json() as Appearance;
      setAppearance(loaded);
      document.documentElement.dataset.theme = loaded.theme;
    } catch (failure) {
      setAppearance(previous);
      document.documentElement.dataset.theme = previous.theme;
      setError(failure instanceof Error ? failure.message : "Appearance could not be saved.");
    } finally { setSaving(false); }
  }, [appearance, saving]);

  return <Context.Provider value={{ ...appearance, ready, saving, error, save }}>{children}</Context.Provider>;
}

export function useAppearance() {
  const context = useContext(Context);
  if (!context) throw new Error("AppearanceProvider is required.");
  return context;
}

export function ThemeSwitch() {
  const { theme, ready, saving, save } = useAppearance();
  return <button className="appearance-switch" role="switch" aria-checked={theme === "dark"} aria-label="Dark mode" disabled={!ready || saving} type="button" onClick={() => void save({ theme: theme === "dark" ? "light" : "dark" })}><span className="appearance-switch-track" aria-hidden><span /></span><span>Dark mode {theme === "dark" ? "on" : "off"}</span></button>;
}

export function AppearanceSettings() {
  const { error, saving } = useAppearance();
  return <section className="settings-parent-card appearance-settings" aria-label="Appearance"><div className="settings-parent-heading"><p className="eyebrow">Appearance</p></div><ThemeSwitch /><p className="appearance-description">Switch between dark and light mode. Your choice follows your account across workspaces and devices.</p><p role="status">{error || (saving ? "Saving…" : "")}</p></section>;
}
