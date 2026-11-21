"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AccountControl } from "@/app/account-control";

type Workspace = { id: string; logoPath: string; name: string };

export function SmartLinksShell({ children }: { children: ReactNode }) {
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetch("/api/workspace/active", { cache: "no-store" }), fetch("/api/workspaces", { cache: "no-store" })]).then(async ([activeResponse, workspacesResponse]) => {
      const active = await activeResponse.json().catch(() => null) as { workspaceId?: string } | null;
      const payload = await workspacesResponse.json().catch(() => null) as { workspaces?: Workspace[] } | null;
      const current = payload?.workspaces?.find((workspace) => workspace.id === active?.workspaceId);
      if (!cancelled && current) setWorkspaceName(current.name);
    });
    return () => { cancelled = true; };
  }, []);
  return <main className="dashboard-shell smart-links-shell"><aside className="sidebar" aria-label="Primary"><div className="brand-header"><AccountControl guidanceContext="none" onGuidanceAbandon={() => undefined} onGuidanceMenuOpen={() => undefined} onOpenAboutDashboard={() => { window.location.assign("/"); }} onOpenGeneralSettings={() => { window.location.assign("/"); }} onOpenPlatformAdministration={() => { window.location.assign("/"); }} onOpenUserSettings={() => { window.location.assign("/"); }} onReady={() => undefined} workspaceLogoUrl="/artistdeck-logo.png" workspaceName={workspaceName} /></div><nav className="nav-list"><Link className="nav-module-dashboard" href="/">Dashboard</Link><Link className="nav-module-marketing" href="/">Marketing</Link><Link aria-current="page" className="nav-module-smart-links" href="/smart-links">Smart Links</Link><Link className="nav-module-production" href="/">Production</Link><Link className="nav-module-platforms" href="/">Platforms</Link><Link className="nav-module-events" href="/">Events</Link><Link className="nav-module-budget" href="/">Budget</Link><Link className="nav-module-roadmap" href="/">Roadmap</Link><Link className="nav-module-studio" href="/">Studio Demo</Link></nav></aside><section className="workspace">{children}</section></main>;
}
