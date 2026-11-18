import assert from "node:assert/strict";
import { runInternalInstagramReelDispatch } from "../lib/server/internal-instagram-reel-dispatch.ts";
let calls = 0;
const mockedMetaDispatcher = async () => { calls++; return { processed: false, mockedMeta: true }; };
for (const receivedSecret of [null, "wrong"]) {
  const result = await runInternalInstagramReelDispatch({ receivedSecret, expectedSecret: "test-secret", publishingEnabled: true, automaticEnabled: true, dispatch: mockedMetaDispatcher });
  assert.equal(result.status, 401);
}
const disabled = await runInternalInstagramReelDispatch({ receivedSecret: "test-secret", expectedSecret: "test-secret", publishingEnabled: false, automaticEnabled: true, dispatch: mockedMetaDispatcher });
assert.equal(disabled.status, 503); assert.equal(calls, 0, "disabled feature flags must not reach a provider dispatcher");
const enabled = await runInternalInstagramReelDispatch({ receivedSecret: "test-secret", expectedSecret: "test-secret", publishingEnabled: true, automaticEnabled: true, dispatch: mockedMetaDispatcher });
assert.equal(enabled.status, 200); assert.deepEqual(enabled.body, { processed: false, mockedMeta: true }); assert.equal(calls, 1);
console.log("internal Instagram Reel dispatcher authentication tests passed");
