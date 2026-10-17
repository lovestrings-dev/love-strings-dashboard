import assert from "node:assert/strict";
import { refreshGoogleAccessToken } from "../lib/google/oauth.ts";

const originalFetch = globalThis.fetch;
const originalClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const originalClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";

try {
  globalThis.fetch = async () => Response.json(
    { error: "invalid_grant", error_description: "Bad Request" }, { status: 400 }
  );
  await assert.rejects(refreshGoogleAccessToken("test-refresh-token"), /invalid_grant.*Reconnect.*General Settings/);

  globalThis.fetch = async () => Response.json(
    { error: "invalid_client", error_description: "Client authentication failed" }, { status: 401 }
  );
  await assert.rejects(refreshGoogleAccessToken("test-refresh-token"), /Client authentication failed/);

  globalThis.fetch = async () => Response.json({ access_token: "test-access-token" });
  assert.equal(await refreshGoogleAccessToken("test-refresh-token"), "test-access-token");
  console.log("Google refresh error and success checks passed.");
} finally {
  globalThis.fetch = originalFetch;
  if (originalClientId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  else process.env.GOOGLE_OAUTH_CLIENT_ID = originalClientId;
  if (originalClientSecret === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  else process.env.GOOGLE_OAUTH_CLIENT_SECRET = originalClientSecret;
}
