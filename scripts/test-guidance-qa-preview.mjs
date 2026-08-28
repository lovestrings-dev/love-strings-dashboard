import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { getGuidancePreviewStatus, guidanceQaWorkspaceName } = await import("../lib/guidance-preview.ts");
const qaPreview = (mode, overrides = {}) => getGuidancePreviewStatus({
  hostname: "localhost",
  mode,
  nodeEnv: "development",
  workspaceName: guidanceQaWorkspaceName,
  ...overrides
});

assert.deepEqual(qaPreview("first-song"), {
  active: true, completed: 1, nextStep: "first_song", program: "getting_started_v1",
  skipped: { artistdeck_basics: false, first_song: false, google_youtube: false, invite_member: false },
  steps: { artistdeck_basics: true, first_song: false, google_youtube: false, invite_member: false }, total: 4
});
assert.equal(qaPreview("google")?.nextStep, "google_youtube", "the Google preview presents 2 of 4");
assert.equal(qaPreview("invite-member")?.nextStep, "invite_member", "the fourth step follows Google in the QA preview");
assert.equal(qaPreview("all-complete")?.completed, 4, "all-complete previews the final 4 of 4 state");
assert.equal(qaPreview("all-complete")?.nextStep, null, "the final preview has Close rather than another recommendation");
assert.equal(qaPreview("first-song", { hostname: "app.example.com" }), null, "non-local hosts cannot enable preview");
assert.equal(qaPreview("first-song", { nodeEnv: "production" }), null, "production cannot enable preview");
assert.equal(qaPreview("first-song", { workspaceName: "A real workspace" }), null, "only the QA Sandbox can preview");
assert.equal(qaPreview("not-a-mode"), null, "unknown preview modes fail closed");

const [route, page, googleConnect, googleCallback] = await Promise.all([
  readFile(new URL("../app/api/guidance/status/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/integrations/google/connect/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/integrations/google/callback/route.ts", import.meta.url), "utf8")
]);
assert.match(route, /serviceClient\.rpc\("get_guidance_status"/, "canonical status RPC remains the default evaluation");
assert.match(route, /nodeEnv: process\.env\.NODE_ENV/, "the route explicitly gates preview by environment");
assert.match(route, /hostname: request\.nextUrl\.hostname/, "the route explicitly gates preview by localhost host name");
assert.match(page, /guidancePreview/, "localhost preview query state is forwarded only to the Guidance status request");
assert.match(page, /previewUrl\.searchParams\.set\("guidancePreview", "google"\)/, "a QA first-song review advances to Google after intentional song creation");
assert.match(page, /guidancePreview=google/, "the guided YouTube action preserves the QA Google preview marker");
assert.match(googleConnect, /ls_google_oauth_guidance_preview/, "only the Google OAuth handoff stores the local QA preview marker");
assert.match(googleConnect, /process\.env\.NODE_ENV === "development"/, "the OAuth preview marker is development-only");
assert.match(googleCallback, /guidancePreview", "invite-member"/, "a successful QA Google preview returns to the final actionable step");
assert.match(googleCallback, /ls_google_oauth_guidance_preview/, "the OAuth preview marker is cleared after the callback");

console.log("Guidance QA preview tests passed.");
