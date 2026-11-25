"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type Consent = "accepted" | "rejected" | "pending";
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; loaded: boolean; push: Fbq; version: string };
const keyFor = (pixelId: string) => `artistdeck:meta-pixel-consent:${pixelId}`;

export function PublicSmartLinkPixel({ pixelId }: { pixelId: string | null }) {
  const [consent, setConsent] = useState<Consent>("pending");
  useEffect(() => { if (!pixelId) return; const timer = window.setTimeout(() => { const saved = window.localStorage.getItem(keyFor(pixelId)); setConsent(saved === "accepted" || saved === "rejected" ? saved : "pending"); }, 0); return () => window.clearTimeout(timer); }, [pixelId]);
  useEffect(() => { if (!pixelId) return; const privacyButton = document.getElementById("public-smart-link-privacy"); const openPreferences = () => setConsent("pending"); privacyButton?.addEventListener("click", openPreferences); return () => privacyButton?.removeEventListener("click", openPreferences); }, [pixelId]);
  useEffect(() => { const content = document.getElementById("public-smart-link-content"); if (!content) return; const pending = Boolean(pixelId) && consent === "pending"; content.setAttribute("aria-hidden", String(pending)); (content as HTMLElement & { inert: boolean }).inert = pending; return () => { content.removeAttribute("aria-hidden"); (content as HTMLElement & { inert: boolean }).inert = false; }; }, [consent, pixelId]);
  useEffect(() => { if (!pixelId || consent !== "accepted" || document.getElementById("artistdeck-meta-pixel")) return; const target = window as Window & { fbq?: Fbq; _fbq?: unknown }; const fbq = ((...args: unknown[]) => { if (fbq.callMethod) fbq.callMethod.apply(fbq, args); else fbq.queue.push(args); }) as Fbq; fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"; target.fbq = fbq; target._fbq = fbq; const script = document.createElement("script"); script.async = true; script.id = "artistdeck-meta-pixel"; script.src = "https://connect.facebook.net/en_US/fbevents.js"; document.head.append(script); fbq("init", pixelId); fbq("track", "PageView"); }, [consent, pixelId]);
  if (!pixelId) return null;
  if (consent !== "pending") return null;
  const choose = (next: Exclude<Consent, "pending">) => { window.localStorage.setItem(keyFor(pixelId), next); setConsent(next); };
  return <div className="public-smart-link-consent-backdrop" role="presentation"><section aria-describedby="pixel-notice-description" aria-labelledby="pixel-notice-title" aria-modal="true" className="public-smart-link-consent" role="dialog"><h2 id="pixel-notice-title"><ShieldCheck aria-hidden size={27} />Privacy Notice</h2><p id="pixel-notice-description">ArtistDeck would like permission to use cookies and similar technologies to measure campaign performance and show ads based on your interests.</p><button autoFocus className="public-smart-link-consent-accept" onClick={() => choose("accepted")} type="button">Accept</button><small>This permission automatically expires and can be revoked at any time. <button onClick={() => choose("rejected")} type="button">Click here to manage permissions</button></small></section></div>;
}
