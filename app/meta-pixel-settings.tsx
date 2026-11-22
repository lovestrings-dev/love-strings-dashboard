"use client";

import { useCallback, useEffect, useState } from "react";

type PixelSettings = { default_pixel_id: string | null; updated_at: string };

export function MetaPixelSettings() {
  const [settings, setSettings] = useState<PixelSettings | null>(null);
  const [value, setValue] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/workspace/meta-pixel", { cache: "no-store" });
      const result = await response.json().catch(() => null) as { settings?: PixelSettings | null; canManage?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Meta Pixel settings could not be loaded.");
      setSettings(result?.settings ?? null); setValue(result?.settings?.default_pixel_id ?? ""); setCanManage(result?.canManage === true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Meta Pixel settings could not be loaded."); } finally { setBusy(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/workspace/meta-pixel", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt: settings?.updated_at ?? null, defaultPixelId: value }) });
      const result = await response.json().catch(() => null) as { settings?: PixelSettings; error?: string } | null;
      if (!response.ok || !result?.settings) throw new Error(result?.error ?? "Meta Pixel settings could not be saved.");
      setSettings(result.settings); setValue(result.settings.default_pixel_id ?? ""); setMessage("Workspace default Pixel saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Meta Pixel settings could not be saved."); } finally { setBusy(false); }
  }

  return <article className="general-settings-card settings-provider-card meta-settings-card meta-pixel-settings">
    <h3>Meta Pixel for Smart Links</h3>
    <p className="settings-description">This workspace default is used by every Smart Link set to <strong>Inherit workspace default</strong>. A specific Smart Link can override it or disable Pixel tracking.</p>
    <div className="meta-pixel-settings-field">
      <label>
        <span>Default Pixel ID</span>
        <input disabled={busy || !canManage} inputMode="numeric" onChange={(event) => setValue(event.target.value)} placeholder="123456789012345" value={value} />
      </label>
      {canManage ? <button disabled={busy} onClick={() => void save()} type="button">{busy ? "Loading…" : "Save default Pixel"}</button> : null}
    </div>
    {message ? <p className="settings-status" role="status">{message}</p> : null}
  </article>;
}
