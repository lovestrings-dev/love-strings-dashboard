// Read-only: checks cloud access without starting a job or deleting outputs.
import { loadEnvFile } from 'node:process';
import { studioGoogleAuthClient, studioStorage, studioStagingBucketName, studioRenderBucketName } from '../lib/server/adstudio-storage.ts';

loadEnvFile('.env.local');
let phase = 'configuration';
try {
  const required = ['VERCEL_OIDC_TOKEN', 'ADSTUDIO_GCP_PROJECT_ID', 'ADSTUDIO_GCP_REGION', 'ADSTUDIO_RENDER_JOB', 'ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing local settings: ${missing.join(', ')}`);
  phase = 'bucket access';
  const storage = await studioStorage();
  for (const name of [studioStagingBucketName(), studioRenderBucketName()]) {
    await storage.bucket(name).getFiles({ maxResults: 1, autoPaginate: false });
    console.log(`Bucket access verified: ${name}`);
  }
  phase = 'render job permissions';
  const auth = studioGoogleAuthClient(['https://www.googleapis.com/auth/cloud-platform']);
  const root = `projects/${process.env.ADSTUDIO_GCP_PROJECT_ID}/locations/${process.env.ADSTUDIO_GCP_REGION}/jobs/${process.env.ADSTUDIO_RENDER_JOB}`;
  const permissions = ['run.jobs.run', 'run.jobs.runWithOverrides'];
  const { data } = await auth.request({ url: `https://run.googleapis.com/v2/${root}:testIamPermissions`, method: 'POST', timeout: 15000, data: { permissions } });
  if (!permissions.every((permission) => data.permissions?.includes(permission))) throw new Error('Required job permission missing.');
  console.log('FFmpeg job execution permissions verified. No render was started.');
} catch (error) {
  // Auth-library errors can contain tokens and full request configuration.
  const data = error?.response?.data;
  const reason = data?.error_description ?? data?.error?.message;
  console.error(`Local Studio check failed during ${phase}.`, { status: error?.response?.status ?? null, code: typeof error?.code === 'string' ? error.code : null, reason: typeof reason === 'string' ? reason.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]').slice(0, 400) : undefined });
  process.exitCode = 1;
}
