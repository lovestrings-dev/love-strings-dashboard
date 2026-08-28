import type { GuidanceStatus } from "@/lib/guidance";

export const guidanceQaWorkspaceName = "ArtistDeck QA Sandbox";

export type GuidancePreviewMode = "first-song" | "google" | "invite-member" | "all-complete";

const previewStatuses: Record<GuidancePreviewMode, GuidanceStatus> = {
  "first-song": {
    active: true,
    completed: 1,
    nextStep: "first_song",
    program: "getting_started_v1",
    skipped: { artistdeck_basics: false, first_song: false, google_youtube: false, invite_member: false },
    steps: { artistdeck_basics: true, first_song: false, google_youtube: false, invite_member: false },
    total: 4
  },
  google: {
    active: true,
    completed: 2,
    nextStep: "google_youtube",
    program: "getting_started_v1",
    skipped: { artistdeck_basics: false, first_song: false, google_youtube: false, invite_member: false },
    steps: { artistdeck_basics: true, first_song: true, google_youtube: false, invite_member: false },
    total: 4
  },
  "invite-member": {
    active: true,
    completed: 3,
    nextStep: "invite_member",
    program: "getting_started_v1",
    skipped: { artistdeck_basics: false, first_song: false, google_youtube: false, invite_member: false },
    steps: { artistdeck_basics: true, first_song: true, google_youtube: true, invite_member: false },
    total: 4
  },
  "all-complete": {
    active: true,
    completed: 4,
    nextStep: null,
    program: "getting_started_v1",
    skipped: { artistdeck_basics: false, first_song: false, google_youtube: false, invite_member: false },
    steps: { artistdeck_basics: true, first_song: true, google_youtube: true, invite_member: true },
    total: 4
  }
};

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getGuidancePreviewStatus({
  hostname,
  mode,
  nodeEnv,
  workspaceName
}: {
  hostname: string;
  mode: string | null;
  nodeEnv: string | undefined;
  workspaceName: string | null;
}): GuidanceStatus | null {
  if (nodeEnv !== "development" || !isLocalDevelopmentHost(hostname)) return null;
  if (workspaceName !== guidanceQaWorkspaceName) return null;
  if (mode !== "first-song" && mode !== "google" && mode !== "invite-member" && mode !== "all-complete") return null;
  return previewStatuses[mode];
}
