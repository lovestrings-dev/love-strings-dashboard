"use client";

import type { ReactNode } from "react";

type Fbq = (...args: unknown[]) => void;

type PublicSmartLinkDestinationProps = {
  buttonLabel: string;
  children: ReactNode;
  destinationId: string;
  href: string;
  platform: string;
  slug: string;
};

export function PublicSmartLinkDestination({ buttonLabel, children, destinationId, href, platform, slug }: PublicSmartLinkDestinationProps) {
  const trackPlay = () => {
    const fbq = (window as Window & { fbq?: Fbq }).fbq;
    if (typeof fbq !== "function") return;
    fbq("trackCustom", "SmartLinkPlay", {
      button_label: buttonLabel,
      platform,
      smart_link_slug: slug
    });
  };

  const trackClick = () => {
    const body = JSON.stringify({ destinationId, type: "destination_click" });
    const endpoint = `/api/public/smart-links/${encodeURIComponent(slug)}/events`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(endpoint, { body, headers: { "content-type": "application/json" }, keepalive: true, method: "POST" });
  };

  return <a data-button-label={buttonLabel} data-platform-key={platform} data-smart-link-destination data-smart-link-slug={slug} href={href} onClickCapture={() => { trackPlay(); trackClick(); }} rel="noopener noreferrer" target="_blank">{children}</a>;
}
