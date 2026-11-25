"use client";

import { useEffect } from "react";

/** Records anonymous aggregate views only; no visitor identity is retained. */
export function PublicSmartLinkTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void fetch(`/api/public/smart-links/${encodeURIComponent(slug)}/events`, {
      body: JSON.stringify({ type: "page_view" }),
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST"
    });
  }, [slug]);

  return null;
}
