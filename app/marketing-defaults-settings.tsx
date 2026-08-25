"use client";

import { Pencil, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { fallbackMarketingTimingDefaults, type MarketingTimingDefaults, validateMarketingTimingDefaults } from "@/lib/marketing-defaults";

export function MarketingDefaultsSettings({ onUpdated }: { onUpdated: (defaults: MarketingTimingDefaults) => void }) {
  const [defaults, setDefaults] = useState<MarketingTimingDefaults>(fallbackMarketingTimingDefaults);
  const [draft, setDraft] = useState<MarketingTimingDefaults>(fallbackMarketingTimingDefaults);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => { let cancelled = false; void fetch("/api/workspace/marketing-defaults", { cache: "no-store" }).then(async (response) => {
    const body = await response.json() as { defaults?: MarketingTimingDefaults; error?: string };
    if (!response.ok || !body.defaults) throw new Error(body.error || "Marketing defaults unavailable.");
    if (!cancelled) { setDefaults(body.defaults); setDraft(body.defaults); onUpdated(body.defaults); }
  }).catch((error) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "Marketing defaults unavailable."); }); return () => { cancelled = true; }; }, [onUpdated]);
  const save = async () => {
    if (!validateMarketingTimingDefaults(draft)) { setStatus("Pre-release promotion must be between 0 and the Song Campaign length minus 1."); return; }
    setStatus("Saving…");
    try {
      const response = await fetch("/api/workspace/marketing-defaults", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await response.json() as { defaults?: MarketingTimingDefaults; error?: string };
      if (!response.ok || !body.defaults) throw new Error(body.error || "Marketing defaults save failed.");
      setDefaults(body.defaults); setDraft(body.defaults); onUpdated(body.defaults); setEditing(false); setStatus("Saved");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Marketing defaults save failed."); }
  };
  const update = (key: keyof MarketingTimingDefaults, value: string) => setDraft((current) => ({ ...current, [key]: value === "" ? 0 : Number(value) }));
  return <div className="marketing-defaults-settings">
    <p className="settings-description production-workflow-summary">Default timing for new campaigns. Existing campaigns keep their saved timing.</p>
    <div className="marketing-defaults-fields">
      <label><span>How long do you normally promote each song?</span><input aria-label="Standard Song Campaign length" disabled={!editing} min="1" onChange={(event) => update("songCampaignLengthDays", event.target.value)} type="number" value={editing ? draft.songCampaignLengthDays : defaults.songCampaignLengthDays} /><em>days</em></label>
      <label><span>How many days before Release do you normally start promotion?</span><input aria-label="Pre-release promotion days" disabled={!editing} min="0" onChange={(event) => update("songCampaignAdvanceDays", event.target.value)} type="number" value={editing ? draft.songCampaignAdvanceDays : defaults.songCampaignAdvanceDays} /><em>days</em></label>
      <label><span>Standard timeframe for a General Campaign</span><input aria-label="Standard General Campaign length" disabled={!editing} min="1" onChange={(event) => update("generalCampaignLengthDays", event.target.value)} type="number" value={editing ? draft.generalCampaignLengthDays : defaults.generalCampaignLengthDays} /><em>days</em></label>
      <button aria-label={editing ? "Save Marketing defaults" : "Edit Marketing defaults"} onClick={() => editing ? void save() : setEditing(true)} type="button">{editing ? <Save size={16} /> : <Pencil size={16} />}</button>
    </div>
    {status ? <p className={status.includes("must") || status.includes("failed") || status.includes("unavailable") ? "settings-error" : "settings-status"} role="status">{status}</p> : null}
  </div>;
}
