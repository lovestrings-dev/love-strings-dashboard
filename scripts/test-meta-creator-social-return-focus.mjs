import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cleanCreatorSocialContinuation, readCreatorSocialContinuation } from "../lib/meta/creator-social-continuation.ts";

const component = await readFile(new URL("../app/meta-page-connection-settings.tsx", import.meta.url), "utf8");

assert.deepEqual(readCreatorSocialContinuation("http://localhost:3000/?campaign=flowers&oauth=creator-social-instagram-connected"), { target: "standalone-instagram", result: "connected" });
assert.deepEqual(readCreatorSocialContinuation("http://localhost:3000/?oauth=creator-social-threads-connected"), { target: "threads", result: "connected" });
assert.equal(readCreatorSocialContinuation("http://localhost:3000/?oauth=creator-social-instagram-connected")?.target, "standalone-instagram");
assert.equal(readCreatorSocialContinuation("http://localhost:3000/?oauth=creator-social-threads-connected")?.target, "threads");
assert.equal(cleanCreatorSocialContinuation("http://localhost:3000/?campaign=flowers&oauth=creator-social-threads-error#meta"), "/?campaign=flowers#meta");
assert.equal(cleanCreatorSocialContinuation("http://localhost:3000/?campaign=flowers"), "/?campaign=flowers");

assert.match(component, /readCreatorSocialContinuation\(window\.location\.href\)/);
assert.match(component, /setIsOpen\(true\)/);
assert.match(component, /creatorSocialContinuation\.target === "standalone-instagram"[\s\S]*await loadCreatorInstagram\(\)/);
assert.match(component, /creatorSocialContinuation\.target === "standalone-instagram"[\s\S]*await loadCreatorThreads\(\)/);
assert.match(component, /creatorSocialReturnReady/);
assert.match(component, /creatorInstagramRef\.current : creatorThreadsRef\.current/);
assert.match(component, /target\.focus\(\{ preventScroll: true \}\)[\s\S]*target\.scrollIntoView/);
assert.match(component, /cleanCreatorSocialContinuation\(window\.location\.href\)[\s\S]*setCreatorSocialContinuation\(null\)/);
assert.match(component, /creatorSocialContinuationConsumed\.current = true/, "focus is one-shot per mounted return");
assert.match(component, /focusRef=\{creatorInstagramRef\}/);
assert.match(component, /focusRef=\{creatorThreadsRef\}/);
assert.match(component, /window\.history\.replaceState\(window\.history\.state, "", cleanCreatorSocialContinuation\(window\.location\.href\)\)/, "marker cleanup is an in-place history replacement");

console.log("Meta App A OAuth return/focus tests passed.");
