"use client";

import { SmartLinksLibrary } from "@/app/components/smart-links-library";
import { SmartLinksShell } from "@/app/components/smart-links-shell";

export default function SmartLinksPage() {
  return <SmartLinksShell><SmartLinksLibrary /></SmartLinksShell>;
}
