import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [page, accountControl, styles] = await Promise.all([
  read("app/page.tsx"),
  read("app/account-control.tsx"),
  read("app/globals.css")
]);

assert.match(page, /createRoadmapAwareProductionSong\(\)/, "Production creation uses the roadmap-aware server path.");
assert.match(page, /await refreshRoadmapPlansAfterProductionCreate\(\)/, "the newly-created Auto Plan is refreshed into the client state.");
assert.match(page, /setRoadmapPlanDrafts\(plans\)/, "the plan state receives the refreshed server result.");
assert.match(page, /secondFrame = window\.requestAnimationFrame\([\s\S]*platform-card-youtube[\s\S]*cardTop[\s\S]*window\.scrollTo/, "guided Google return waits for rendered cards before centering YouTube.");
assert.match(page, /setActiveSection\("Dashboard"\)/, "a successful guided invitation returns to Dashboard.");
assert.match(page, /window\.scrollTo\(\{ behavior: "auto", top: 0 \}\)/, "guided invitation success places the completed checklist at the top.");
assert.match(page, /otherTasks\.some\(\(otherTask\) => otherTask\.id === taskId\)/, "persisted starter tasks resolve as editable ordinary Other Tasks.");
assert.match(page, /function getNeutralPlatformStatsTemplate\(_rows: MetricRow\[\]\)/, "neutral card construction is independent of imported metric rows.");
assert.doesNotMatch(page, /platformSlugs\.has\(platform\.slug\)/, "zero-metric workspaces do not hide their supported cards.");
assert.match(page, /return stats\.filter\(\(platform\) => \{[\s\S]*youtube-music/, "YouTube itself remains visible while only Topic is configuration-gated.");
assert.match(page, /\? "—"\n\s*: String\(value\)/, "unavailable platform values render as an em dash.");
assert.match(page, /AudienceCardEmptyState/, "Audience retains labeled unavailable-metric rendering.");
assert.match(accountControl, /resolvedWorkspaceLogoUrl = workspaceLogoUrl \|\| "\/artistdeck-logo\.png"/, "ArtistDeck branding is the non-persistent workspace-logo fallback.");
assert.match(accountControl, /aria-label=\{`Open workspace menu for \$\{workspaceName\}`\}/, "the left logo remains the workspace menu trigger.");
assert.match(accountControl, /className=\{`account-avatar/, "the far-right avatar remains display-only.");
assert.match(styles, /grid-template-columns: 44px minmax\(0, 1fr\) 44px;/, "header logo and avatar have matching layout footprints.");
assert.match(styles, /\.account-avatar \{[\s\S]*height: 44px;[\s\S]*width: 44px;/, "the avatar matches the workspace logo diameter.");
assert.match(styles, /\.dashboard-campaign-card-empty h3 \{\n  color: var\(--text\);/, "empty campaign copy uses default black text.");
assert.match(styles, /\.dashboard-event-card \.dashboard-event-empty \{\n  color: var\(--text\);/, "empty Events copy uses default black text.");

console.log("Beta 1.28 onboarding acceptance regression contracts passed.");
