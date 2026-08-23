import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const appleRoute = await readFile(new URL("../app/api/apple-music/import/route.ts", import.meta.url), "utf8");
const spotifyRoute = await readFile(new URL("../app/api/spotify/import/route.ts", import.meta.url), "utf8");

assert.match(page, /Apple Music.*last upload/);
assert.match(page, /Spotify.*last upload/);
assert.match(page, /Data as of:/);
assert.match(page, /row\.metric_name === "audience_data_date"/);
assert.match(page, /const playlistHeaders = \["title", "author", "listeners", "streams", "date added"\]/);
assert.match(page, /All Playlists Listeners/);
assert.match(page, /All Playlists Streams/);
assert.match(page, /variant === "dashboard" && platform\.slug === "spotify"/);
assert.doesNotMatch(page, /songs_data_date/);
assert.doesNotMatch(page, /\["spotify", "deezer", "amazon-music"\]/);
assert.match(appleRoute, /payload\.reportEndDate <= existingReportEndDate/);
assert.match(appleRoute, /noNewData: true/);
assert.match(spotifyRoute, /authoritativeDate <= existingDate/);
assert.match(spotifyRoute, /noNewData: true/);
assert.match(spotifyRoute, /selectSpotifyAudienceHistory/);
assert.match(spotifyRoute, /spotify-playlists-csv/);
assert.match(page, /No new data dates were found/);
console.log("Spotify CSV freshness UI checks passed.");
