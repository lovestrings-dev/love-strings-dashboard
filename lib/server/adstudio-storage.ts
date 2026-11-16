import { Storage } from "@google-cloud/storage";
import { Impersonated, IdentityPoolClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";

const storageScope = "https://www.googleapis.com/auth/devstorage.read_write";

export function studioStagingBucketName() {
  const bucket = process.env.ADSTUDIO_STAGING_BUCKET;
  if (!bucket) throw new Error("Private Studio storage is not configured. Add ADSTUDIO_STAGING_BUCKET to the server environment.");
  return bucket;
}

export async function studioStorage() {
  const projectId = process.env.ADSTUDIO_GCP_PROJECT_ID;
  const audience = process.env.ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE;
  const serviceAccount = process.env.ADSTUDIO_GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "adstudio-service@project-eda6605c-73e6-4361-9ad.iam.gserviceaccount.com";
  if (!projectId || !audience) throw new Error("Private Studio storage is not configured. Add ADSTUDIO_GCP_PROJECT_ID and ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE to the server environment.");

  const sourceClient = new IdentityPoolClient({
    audience,
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    type: "external_account"
  });
  const authClient = new Impersonated({
    lifetime: 600,
    sourceClient,
    targetPrincipal: serviceAccount,
    targetScopes: [storageScope]
  });
  // @google-cloud/storage currently exposes a narrower AuthClient type than
  // google-auth-library's Impersonated client, although both implement the
  // token and signBlob contract used by Storage's V4 signer.
  return new Storage({ authClient: authClient as never, projectId });
}

export function workspaceVideoObjectPath(workspaceId: string, assetId: string, extension: string) {
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  return `workspaces/${workspaceId}/studio/uploads/${assetId}.${safeExtension}`;
}
