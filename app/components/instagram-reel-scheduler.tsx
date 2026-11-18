"use client";
import { useEffect, useMemo, useState } from "react";
import { zonedScheduleToUtc } from "@/lib/instagram-reel-schedule";
type Render = { id: string; status: string; details?: { audioTitle?: string } | null };
type Props = { renders: Render[] };
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export function InstagramReelScheduler({ renders }: Props) {
  const [enabled, setEnabled] = useState(false), [admin, setAdmin] = useState(false), [chosen, setChosen] = useState<string[]>([]), [caption, setCaption] = useState(""), [mode, setMode] = useState<"normal" | "trial">("normal"), [graduation, setGraduation] = useState<"manual" | "ss_performance">("manual"), [date, setDate] = useState(""), [time, setTime] = useState("12:00"), [timezone, setTimezone] = useState(zone), [notice, setNotice] = useState("");
  useEffect(() => { void fetch("/api/studio/instagram-reels").then(async r => { const x = await r.json() as { enabled?: boolean; canManage?: boolean }; setEnabled(!!x.enabled); setAdmin(!!x.canManage); }).catch(() => undefined); }, []);
  const ready = renders.filter((r) => r.status === "succeeded");
  const preview = useMemo(() => chosen.map((id, i) => { try { return { id, when: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(zonedScheduleToUtc({ date: date || "2099-01-01", time, timezone, offsetDays: i }))) }; } catch { return { id, when: "Choose a valid date, time, and timezone" }; } }), [chosen, date, time, timezone]);
  async function save() { try { if (!date || !chosen.length || !caption.trim()) throw new Error("Choose outputs, a caption, and a start date."); const items = chosen.map((renderJobId, index) => ({ renderJobId, caption: caption.trim(), scheduledFor: zonedScheduleToUtc({ date, time, timezone, offsetDays: index }), timezone, publishingMode: mode, graduationStrategy: mode === "trial" ? graduation : undefined })); const r = await fetch("/api/studio/instagram-reels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) }); const x = await r.json() as { error?: string; publications?: unknown[] }; if (!r.ok) throw new Error(x.error ?? "Scheduling failed."); setNotice(`${x.publications?.length ?? 0} Reel(s) scheduled. Media was retained privately for publishing.`); setChosen([]); } catch (e) { setNotice(e instanceof Error ? e.message : "Scheduling failed."); } }
  if (!ready.length) return null;
  return <section className="studio-source-category" aria-label="Instagram Reel scheduling">
    <summary><strong>Instagram Reels</strong><span>{enabled ? "Optional publishing" : "Disabled"} <i aria-hidden>⌄</i></span></summary>
    <div className="studio-export-audio-sources">
      <p>Schedule up to 30 rendered videos. Publishing remains disabled until an Admin enables the feature and completes its separate Meta publishing authorization.</p>
      {!enabled ? <p role="status">Instagram publishing is feature-flagged off.</p> : !admin ? <p role="status">Only a Workspace Admin can schedule Reels.</p> : <>
        <a href="/api/integrations/meta/fstats-login/publishing/connect?return=/">Enable or reauthorize Instagram publishing</a>
        <label>Caption<textarea value={caption} maxLength={2200} onChange={(e) => setCaption(e.target.value)} placeholder="Caption used exactly at publish time" /></label>
        <fieldset><legend>Publishing mode</legend><label><input type="radio" checked={mode === "normal"} onChange={() => setMode("normal")} /> Normal Reel</label><label><input type="radio" checked={mode === "trial"} onChange={() => setMode("trial")} /> Trial Reel (Meta may reject if unavailable)</label>{mode === "trial" ? <select value={graduation} onChange={(e) => setGraduation(e.target.value as typeof graduation)}><option value="manual">Manual graduation</option><option value="ss_performance">Auto-graduate by performance</option></select> : null}</fieldset>
        <label>Start date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label>Daily time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label><label>Timezone<input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></label>
        <div>{ready.map((render) => <label key={render.id}><input type="checkbox" checked={chosen.includes(render.id)} disabled={!chosen.includes(render.id) && chosen.length >= 30} onChange={() => setChosen((current) => current.includes(render.id) ? current.filter((id) => id !== render.id) : [...current, render.id])} /> {render.details?.audioTitle ?? "Studio output"}</label>)}</div>
        {preview.length ? <ol>{preview.map((item) => <li key={item.id}>{item.when} ({timezone})</li>)}</ol> : null}<button type="button" onClick={() => void save()} disabled={!chosen.length}>Save schedule</button>
      </>}
      {notice ? <p role="status">{notice}</p> : null}
    </div>
  </section>;
}
