"use client";
import { useEffect, useRef, useState } from "react";
import { defaultOverlayComposition, fitOverlaysToDuration, migrateLegacyOverlays, validateOverlayComposition, type OverlayComposition, type OverlayRaster, type OverlaySnapshot } from "@/lib/studio/overlays";

export function useStudioOverlays(workspaceId: string, duration: number, artworks: Array<{ id: string; url: string }> = []) {
  const [composition, setComposition] = useState<OverlayComposition>(() => defaultOverlayComposition(duration, artworks[0]));
  const [snapshot, setSnapshot] = useState<OverlaySnapshot | null>(null);
  const [loaded, setLoaded] = useState(false); const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const initial = useRef({ duration, artworks }); const inFlight = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/studio/overlays", { signal: controller.signal }); const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Overlay settings could not load.");
        if (controller.signal.aborted) return;
        const saved = validateOverlayComposition(data.composition);
        let next = saved;
        if (!next) {
          let legacy: unknown; try { legacy = JSON.parse(localStorage.getItem(`workspace:${workspaceId}:studio-overlay-composition-v1`) ?? "null"); } catch { /* optional device draft */ }
          next = migrateLegacyOverlays(legacy, initial.current.duration, initial.current.artworks);
        }
        setComposition(next); setSnapshot(saved ? { revision: data.revision, composition: saved } : { revision: data.revision, composition: { schemaVersion: 2, layers: [] } }); setCanEdit(data.canEdit); setLoaded(true);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Overlays could not load."); }
    })();
    return () => controller.abort();
  }, [workspaceId]);
  const fullLengthComposition = fitOverlaysToDuration(composition, duration);
  const key = JSON.stringify(validateOverlayComposition(fullLengthComposition)); const savedKey = snapshot ? JSON.stringify(validateOverlayComposition(snapshot.composition)) : "";
  useEffect(() => {
    if (!loaded || !canEdit || !snapshot || key === savedKey || error || inFlight.current) return;
    const timer = window.setTimeout(async () => {
      inFlight.current = true; setSaving(true);
      try {
        const response = await fetch("/api/studio/overlays", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: snapshot.revision, composition: JSON.parse(key) }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Overlays could not save.");
        if (mounted.current) setSnapshot({ revision: data.revision, composition: validateOverlayComposition(data.composition)! });
      } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Overlays could not save."); }
      finally { inFlight.current = false; if (mounted.current) { setSaving(false); setRetry((n) => n + 1); } }
    }, 500);
    return () => clearTimeout(timer);
  }, [canEdit, error, key, loaded, retry, savedKey, snapshot]);
  return { composition: fullLengthComposition, setComposition, snapshot, loaded, canEdit, error, saving: saving || key !== savedKey, saved: loaded && key === savedKey && !error, retrySave: () => { setError(""); setRetry((n) => n + 1); } };
}

export function useOverlayRasters(composition: OverlayComposition) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(composition);
  const [result, setResult] = useState<{ key: string; layers: OverlayRaster[]; videoLayers: Record<string, OverlayRaster[]> }>({ key: "", layers: [], videoLayers: {} });
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/studio/overlays/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ composition: JSON.parse(key) }), signal: controller.signal });
        const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Overlay preview could not load.");
        if (!controller.signal.aborted) { setResult({ key, layers: data.layers, videoLayers: data.videoLayers ?? {} }); setError(""); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Overlay preview could not load."); }
    }, 400);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [key, attempt]);
  return { layers: result.layers, videoLayers: result.videoLayers, ready: result.key === key && !error, error, retry: () => setAttempt((n) => n + 1) };
}
