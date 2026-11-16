import assert from "node:assert/strict";
import { studioStorage } from "../lib/server/adstudio-storage.ts";

// Exercise the real Storage -> external account -> impersonation -> signBlob
// path, replacing only network/subject-token boundaries. No live credentials.
const keys = ["ADSTUDIO_GCP_PROJECT_ID", "ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE", "ADSTUDIO_GOOGLE_SERVICE_ACCOUNT_EMAIL"];
const previous = keys.map((key) => process.env[key]);
try {
  process.env.ADSTUDIO_GCP_PROJECT_ID = "signing-test";
  process.env.ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE = "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/test/providers/vercel";
  process.env.ADSTUDIO_GOOGLE_SERVICE_ACCOUNT_EMAIL = "studio@signing-test.iam.gserviceaccount.com";
  const storage = await studioStorage();
  const client = await storage.authClient.getClient();
  client.retrieveSubjectToken = async () => "test-subject";
  client.stsCredential.exchangeToken = async (options) => {
    assert.equal(options.audience, process.env.ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE);
    assert.equal(options.subjectToken, "test-subject");
    return { access_token: "test-federated" };
  };
  const calls = [];
  client.transporter.request = async (options) => {
    const url = String(options.url);
    calls.push(url);
    assert.equal(options.method, "POST");
    if (url.endsWith(":generateAccessToken")) {
      assert.equal(options.headers.Authorization, "Bearer test-federated");
      assert.ok(options.data.scope.includes("https://www.googleapis.com/auth/devstorage.read_write"));
      assert.ok(options.data.scope.includes("https://www.googleapis.com/auth/iam"), "The impersonated token must authorize IAM signBlob, not only Storage");
      return { data: { accessToken: "test-impersonated", expireTime: new Date(Date.now() + 3600000).toISOString() } };
    }
    assert.ok(url.endsWith("/studio@signing-test.iam.gserviceaccount.com:signBlob"));
    assert.equal(options.headers.Authorization, "Bearer test-impersonated");
    assert.ok(options.data.payload);
    return { data: { signedBlob: Buffer.from("test-signature").toString("base64") } };
  };
  for (const action of ["write", "read"]) {
    const [signedUrl] = await storage.bucket("test-private").file("workspaces/test/studio/uploads/test.mp4").getSignedUrl({
      action, expires: Date.now() + 600000, version: "v4",
      ...(action === "write" ? { contentType: "video/mp4" } : {})
    });
    const url = new URL(signedUrl);
    assert.ok(url.searchParams.get("X-Goog-Credential").startsWith("studio@signing-test.iam.gserviceaccount.com/"));
    assert.equal(url.searchParams.get("X-Goog-Algorithm"), "GOOG4-RSA-SHA256");
  }
  assert.equal(calls.filter((url) => url.endsWith(":generateAccessToken")).length, 1);
  assert.equal(calls.filter((url) => url.endsWith(":signBlob")).length, 2);
  console.log("Studio private upload/preview signing regression passed.");
} finally {
  keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  });
}
