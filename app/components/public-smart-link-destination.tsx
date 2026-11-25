"use client";

import type { ReactNode } from "react";

type Fbq = (...args: unknown[]) => void;

type PublicSmartLinkDestinationProps = {
  buttonLabel: string;
  children: ReactNode;
  href: string;
  platform: string;
  slug: string;
};

export function PublicSmartLinkDestination({ buttonLabel, children, href, platform, slug }: PublicSmartLinkDestinationProps) {
  const trackPlay = () => {
    const fbq = (window as Window & { fbq?: Fbq }).fbq;
    if (typeof fbq !== "function") return;
    fbq("trackCustom", "SmartLinkPlay", {
      button_label: buttonLabel,
      platform,
      smart_link_slug: slug
    });
  };

  return <a data-button-label={buttonLabel} data-platform-key={platform} data-smart-link-destination data-smart-link-slug={slug} href={href} onClickCapture={trackPlay} rel="noopener noreferrer" target="_blank">{children}</a>;
}
