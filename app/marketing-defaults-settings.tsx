"use client";

import { Pencil, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { fallbackMarketingTimingDefaults, type MarketingTimingDefaults, validateMarketingTimingDefaults } from "@/lib/marketing-defaults";

export function MarketingDefaultsSettings({ onUpdated }: { onUpdated: (defaults: MarketingTimingDefaults) => void }) {
  const [defaults, setDefaults] = useState<MarketingTimingDefaults>(fallbackMarketingTimingDefaults);
  const [draft, setDraft] = useState<MarketingTimingDefaults>(fallbackMarketingTimingDefaults);
  const [editingKey, setEditingKey] = useState<keyof MarketingTimingDefaults | null>(null);
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
      setDefaults(body.defaults); setDraft(body.defaults); onUpdated(body.defaults); setEditingKey(null); setStatus("Saved");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Marketing defaults save failed."); }
  };
  const update = (key: keyof MarketingTimingDefaults, value: string) => setDraft((current) => ({ ...current, [key]: value === "" ? 0 : Number(value) }));
  const timingFields: Array<{ key: keyof MarketingTimingDefaults; label: string; min: string }> = [
    { key: "songCampaignLengthDays", label: "How long do you normally promote each song?", min: "1" },
    { key: "songCampaignAdvanceDays", label: "How many days before Release do you normally start promotion?", min: "0" },
    { key: "generalCampaignLengthDays", label: "Standard timeframe for a General Campaign", min: "1" },
  ];
  return <div className="marketing-defaults-settings">
    <p className="settings-description production-workflow-summary">Default timing for new campaigns. Existing campaigns keep their saved timing.</p>
    <div className="marketing-defaults-fields">
      {timingFields.map(({ key, label, min }) => {
        const isEditing = editingKey === key;
        const ariaLabel = key === "songCampaignLengthDays" ? "Standard Song Campaign length" : key === "songCampaignAdvanceDays" ? "Pre-release promotion days" : "Standard General Campaign length";
        return <label key={key}><span>{label}</span><div className="marketing-defaults-row"><input aria-label={ariaLabel} disabled={!isEditing} min={min} onChange={(event) => update(key, event.target.value)} type="number" value={isEditing ? draft[key] : defaults[key]} /><em>days</em><button aria-label={isEditing ? `Save ${label}` : `Edit ${label}`} onClick={() => isEditing ? void save() : setEditingKey(key)} type="button">{isEditing ? <Save size={16} /> : <Pencil size={16} />}</button></div></label>;
      })}
    </div>
    {status ? <p className={status.includes("must") || status.includes("failed") || status.includes("unavailable") ? "settings-error" : "settings-status"} role="status">{status}</p> : null}
  </div>;
}
