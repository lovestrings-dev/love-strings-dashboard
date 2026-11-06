"use client";

import { ArrowDown, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const refreshDistance = 72;

export function PullToRefresh() {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const standalone = () => window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let start: { x: number; y: number; id: number } | null = null;
    let pull = 0;
    let reloading = false;
    const reset = () => { start = null; pull = 0; setDistance(0); };

    function begin(event: TouchEvent) {
      if (start) reset();
      if (!standalone() || reloading || event.touches.length !== 1 || window.scrollY > 0 || document.querySelector("dialog[open]")) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest("input, textarea, select, button, a, [contenteditable], [role=slider], nav")) return;
      if (document.activeElement?.matches("input, textarea, select, [contenteditable]")) return;
      // Nested scrollable panels retain their own touch behavior.
      for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY)) return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
    }

    function move(event: TouchEvent) {
      if (!start || reloading) return;
      if (event.touches.length !== 1 || event.touches[0].identifier !== start.id || window.scrollY > 0) { reset(); return; }
      const touch = event.touches[0];
      const dy = touch.clientY - start.y;
      const dx = Math.abs(touch.clientX - start.x);
      if (dy <= 0 || dx > Math.abs(dy)) { reset(); return; }
      if (!event.cancelable) { reset(); return; }
      event.preventDefault();
      pull = Math.min(110, dy * 0.5);
      setDistance(pull);
    }

    function end(event: TouchEvent) {
      if (!start || reloading) return;
      if (event.touches.length) { reset(); return; }
      start = null;
      if (pull < refreshDistance) { reset(); return; }
      reloading = true;
      setRefreshing(true);
      window.location.reload();
    }

    document.addEventListener("touchstart", begin, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", reset);
    return () => {
      document.removeEventListener("touchstart", begin);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", reset);
    };
  }, []);

  if (!distance && !refreshing) return null;
  const ready = distance >= refreshDistance;
  return (
    <div className="pull-to-refresh" role="status" aria-live="polite">
      {refreshing ? <RefreshCw className="pull-to-refresh-spinner" size={18} aria-hidden /> : <ArrowDown size={18} aria-hidden style={{ transform: ready ? "rotate(180deg)" : undefined }} />}
      <span>{refreshing ? "Refreshing…" : ready ? "Release to refresh" : "Pull to refresh"}</span>
    </div>
  );
}
