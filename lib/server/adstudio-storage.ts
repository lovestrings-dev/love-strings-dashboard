import { Storage } from "@google-cloud/storage";
import { ExternalAccountClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";

const storageScope = "https://www.googleapis.com/auth/devstorage.read_write";
const signingScope = "https://www.googleapis.com/auth/iam";

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

  // Keep this configuration in the documented external-account shape. The
  // Storage client needs the impersonated service account identity in order to
  // create V4 signed upload URLs; a separately constructed `Impersonated`
  // client loses that identity when Storage wraps it in GoogleAuth.
  const authClient = ExternalAccountClient.fromJSON({
    audience,
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    // Storage calls IAM signBlob with the impersonated token for V4 URLs.
    // A storage-only token cannot sign, even with the Token Creator IAM role.
    scopes: [storageScope, signingScope],
    token_url: "https://sts.googleapis.com/v1/token",
    type: "external_account"
  });
  if (!authClient) throw new Error("Unable to initialize private Studio storage credentials.");
  return new Storage({ authClient, projectId });
}

export function workspaceVideoObjectPath(workspaceId: string, assetId: string, extension: string) {
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  return `workspaces/${workspaceId}/studio/uploads/${assetId}.${safeExtension}`;
}
