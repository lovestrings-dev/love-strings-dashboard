"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { spotifyEvolutionCharts, type SpotifyEvolutionRow } from "@/lib/spotify-evolution";
import { EvolutionPanel } from "./evolution-panel";
import type { EvolutionMode, EvolutionRange } from "@/lib/platform-evolution";

type Props = {
  workspaceId: string;
  refreshKey: unknown;
  range: EvolutionRange;
  mode: EvolutionMode;
  onRangeChange: (range: EvolutionRange) => void;
  onModeChange: (mode: EvolutionMode) => void;
  today: string;
};
export function SpotifyEvolution({ workspaceId, refreshKey, range, mode, onRangeChange, onModeChange, today }: Props) {
  const [history, setHistory] = useState<{ workspaceId: string; rows: SpotifyEvolutionRow[]; state: "loading" | "ready" | "error" }>({ workspaceId, rows: [], state: "loading" });
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const client = createBrowserSupabaseClient();
        const rows: SpotifyEvolutionRow[] = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await client.from("platform_metric_snapshots")
            .select("id, metric_name, metric_value, snapshot_date, imported_at, platforms!inner(slug)")
            .eq("workspace_id", workspaceId).eq("platforms.slug", "spotify")
            .eq("source", "spotify-audience-csv")
            .in("metric_name", ["followers", "monthly_active_listeners", "listeners", "streams"])
            .order("snapshot_date", { ascending: true }).order("imported_at", { ascending: true }).order("id", { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (error) throw error;
          if (cancelled) return;
          rows.push(...(data ?? []));
          if (!data || data.length < pageSize) break;
        }
        if (!cancelled) setHistory({ workspaceId, rows, state: "ready" });
      } catch {
        if (!cancelled) setHistory({ workspaceId, rows: [], state: "error" });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [workspaceId, refreshKey]);
  const currentHistory = history.workspaceId === workspaceId ? history : { rows: [], state: "loading" };
  const charts = spotifyEvolutionCharts(currentHistory.rows);
  return <EvolutionPanel
    charts={charts} range={range} mode={mode} onRangeChange={onRangeChange} onModeChange={onModeChange} today={today}
    state={currentHistory.state as "ready" | "loading" | "error"}
    label="Spotify Evolution graphs" description="Recorded Audience CSV observations only."
    footer="History is sampled monthly from Audience CSV imports. KPI cards may use a newer Audience observation or a different Songs CSV reporting period."
  />;
}
