import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [page, accountControl, styles] = await Promise.all([
  read("app/page.tsx"),
  read("app/account-control.tsx"),
  read("app/globals.css")
]);

assert.equal((page.match(/fetch\(guidanceStatusUrl/g) ?? []).length, 1, "the client uses one Guidance status request path");
assert.match(page, /setGuidanceStatus\(null\)/, "a Guidance status failure hides the optional helper");
assert.match(page, /!settingsView && guidanceStatus\?\.active \?/, "inactive and excluded settings surfaces render no helper");
assert.doesNotMatch(page, /function QrCodeLinksSection[\s\S]*GettingStartedCard/, "QR Codes has no embedded Guidance helper");
assert.match(page, /Getting started · \{status\.completed\} of \{status\.total\}/, "the shared card reports canonical progress");
assert.match(page, /Create song/, "the first-song action remains a normal Production action");
assert.doesNotMatch(page, /Create your first song<\//, "the first-song CTA uses the concise approved label");
assert.match(page, /Connect<\/button><button className="guidance-skip-button"/, "the Google primary CTA uses the concise approved label");
assert.match(page, /setActiveSection\("Production"\)/, "the first-song action opens Production rather than a special page");
assert.match(page, /setGuidanceContext\("add-song"\)/, "Guidance entry to Production starts an Add song cue");
assert.match(page, /guidanceAddSongHint=\{guidanceContext === "add-song"\}/, "only the guided Production entry receives the Add song cue");
assert.match(page, /const wasGuidanceAddSong = guidanceContext === "add-song"/, "starting song creation stops the Add song cue");
assert.match(page, /wasGuidanceAddSong \|\| \(guidanceStatus\?\.active/, "a successful guided creation continues to the Song options cue");
assert.match(page, /guidanceSongId === song\.id/, "only the newly created song receives the Song options cue");
assert.match(page, /function navigateToSidebarSection[\s\S]*setGuidanceContext\("none"\)/, "leaving Production through navigation abandons the song cue");
assert.match(page, /setActiveGeneralSettingsPanel\("google"\)/, "the selected Settings destination opens Google Services");
assert.match(page, /googleServicesRef\.current\?\.scrollIntoView/, "the Google Services panel is brought into view");
assert.match(page, /guidanceGoogleConnectHint/, "Google Services can receive the final YouTube Connect cue");
assert.match(page, /onGuidanceGoogleConnectStart\(\);[\s\S]*google\/connect\?service=youtube/, "starting external Google authorization stops the final cue without completing Guidance");
assert.match(page, /onInviteMember/, "the fourth Guidance action opens the existing Member access surface");
assert.match(page, /setActiveGeneralSettingsPanel\("members"\)/, "the guided Member action opens its child panel directly");
assert.match(page, /guidanceMemberInviteHint/, "the existing Invite Member card receives the focused Guidance cue");
assert.match(page, /setInvitationRole\] = useState<WorkspaceRole>\("member"\)/, "new workspace invitations default to Member rather than Viewer");
assert.match(page, /invitationLifecycleStatus\.state === "loading"/, "guided Invite focus waits for invitation data to settle");
assert.match(page, /membershipStatus\.state === "loading"/, "guided Invite focus waits for member data to settle");
assert.match(page, /guidancePreview"\) === "invite-member"/, "a completed QA invitation advances to the all-complete preview");
assert.match(page, /setGuidanceYouTubeCardHint\(false\)/, "the invitation handoff clears the prior YouTube card cue");
assert.match(page, /!platform\.isAudiencePlaceholder \? <>/, "connection-backed cards retain their supported metric labels while disconnected");
assert.match(page, /metrics: canonicalCard\?\.metrics \?\? \[\]/, "YouTube Topic previews its supported metric labels while unconnected");
assert.match(page, /Skip step/, "the recommended actionable step has a visible skip action");
assert.match(page, /skipGuidanceStep/, "skip uses the shared Guidance status boundary");
assert.match(page, /production-collapse-button/, "Production has a bottom-row Collapse control");
assert.match(page, /aria-label=\{isSongOpen \? "Collapse song" : "Expand song"\}/, "Production collapse state remains accessible");
assert.match(accountControl, /guidanceContext === "google-logo"/, "the existing workspace logo is the Google journey cue");
assert.match(accountControl, /guidance-target-light/, "the dark-header Guidance targets use a light treatment");
assert.match(accountControl, /guidance-menu-settings/, "the existing General Settings item is highlighted from the account menu");
assert.match(accountControl, /onGuidanceAbandon\(\);/, "other choices and dismissals abandon the contextual journey");
assert.match(styles, /\.guidance-card[\s\S]*#101817/, "the compact card has a distinct dark guidance treatment");
assert.match(styles, /guidance-song-options-pulse/, "the Song options cue uses a gentle dark pulse");
assert.match(styles, /guidance-light-pulse/, "logo and menu cues use a white pulse for the dark header");
assert.match(styles, /\.guidance-target, \.guidance-target-light \{ animation: none; \}/, "all Guidance pulses have a reduced-motion fallback");
assert.match(styles, /@media \(max-width: 540px\)/, "the helper has a mobile-safe compact rule");

console.log("Guidance visual helper interaction contracts passed.");
