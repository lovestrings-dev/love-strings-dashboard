# Studio OIDC bridge repair — 2026-11-16

Status: approved by Dmitrii and applied on 2026-11-16. Provider audience and
exact Production subject condition are corrected. The matching service-account
workload principal was added and the stale principal removed. Connector readback
confirms the final policy and unchanged self token-creator binding.
No app deployment, Vercel environment, bucket, credential or database change.
Runtime retry now reaches a different signing error; see follow-up below.

## Authenticated upload follow-up

After sign-in, Dmitrii selected `canvas_1.mp4` (1080 × 1920, about eight
seconds, 7.6 MB). The UI reports `Insufficient Permission` and retains it as a
local preview. The Production log at `2026-11-16T16:48:55.546Z` identifies
`POST create-signed-upload-url` / `SigningError: Insufficient Permission` on
deployment `dpl_FF6sqsAvsJe5PCZDG9u2XmbHwhRC`. The audience rejection is gone;
successful cloud registration is still unverified.

The helper requests only `devstorage.read_write` for its impersonated token.
GoogleAuth uses that token to call IAM Credentials `signBlob`, which requires
the `iam` or `cloud-platform` OAuth scope in addition to the existing IAM role.
The local repair adds the narrower `https://www.googleapis.com/auth/iam` scope
alongside Storage scope. No IAM role expansion or credential key is needed.

`scripts/test-studio-storage-signing.mjs` exercises real Storage/GoogleAuth
external-account impersonation and V4 upload/preview signing, mocking only
the subject-token and network boundaries. It checks the impersonation request
scopes, service-account identity, signing endpoint and token reuse.
Signing regression, TypeScript, targeted strict ESLint, production build (64
pages), and diff integrity checks passed. Local code repair is not deployed;
Production deployment needs approval.

Reference: [Google signBlob authorization scopes](https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signBlob).

## Execution record

- Re-read both resources before mutation; baseline matched the audit.
- Saved non-secret baseline and resulting JSON in adjacent
  `studio-oidc-bridge-before-{provider,policy}-2026-11-16.json` and
  `studio-oidc-bridge-after-{provider,policy}-2026-11-16.json` files.
- Provider update succeeded through the Google connector.
- Connector rejected both `add-iam-policy-binding` and `set-iam-policy` as
  unsupported verbs. Neither attempt changed the service-account policy.
- Finished the two binding changes in the internal browser Cloud Console,
  using the signed-in Artist Deck account supplied by the user. Visible success
  messages confirmed both updates; connector readback independently confirmed
  only the corrected exact Production principal plus the original self role.
- The initial browser test reached ArtistDeck sign-in. The later authenticated
  retry is recorded above. No successful signed URL, direct PUT, metadata row,
  cross-device or isolation result is claimed yet.

## Live evidence before repair

| Setting | Observed value |
| --- | --- |
| Vercel project | `love-strings-dashboard` / `prj_otqxek2aZ9ROmGzdC6fQqBgLdhvI` |
| Vercel owning team | `love-strings-dashboard` / `team_qOwsVp0IOfn0tYnOHa3T4s5h` |
| Production deployment | `dpl_FF6sqsAvsJe5PCZDG9u2XmbHwhRC`, READY |
| Runtime token audience | `https://vercel.com/love-strings-dashboard` (production error in handoff) |
| Google provider allowed audience | `https://vercel.com/lovestrings-dev` |
| Google provider issuer | `https://oidc.vercel.com` |
| Google provider condition | `assertion.sub == 'owner:lovestrings-dev:project:love-strings-dashboard:environment:production'` |
| Service-account workload binding | Same outdated `owner:lovestrings-dev:...` subject |
| Vercel external-account resource audience | `//iam.googleapis.com/projects/1023633877337/locations/global/workloadIdentityPools/adstudio-vercel/providers/vercel` |
| Vercel Studio environment variables | All four current `ADSTUDIO_*` entries target Production only |

Expected production subject, derived from the live owning team/project and
Vercel's documented subject format:
`owner:love-strings-dashboard:project:love-strings-dashboard:environment:production`.
The token subject itself has not been captured; this distinction matters if a
subsequent exchange fails its attribute condition.

## Selected repair

Use the existing default-token path and Google's explicit allowed-audience mode.
Correct the audience, exact production-subject condition, and service-account
principal together. Keep the global issuer and existing code/resource audience.
This needs no app deployment or Vercel environment mutation.

The handoff's custom-audience alternative is incomplete: Vercel's exchange also
sets the issuer to `https://oidc.vercel.com/{owner}` while preserving the original
owner/project/environment claims. It would therefore require an issuer change
and the subject/binding corrections too. Merely supplying a custom audience
does not repair the current Google trust configuration.

## Approved changes (applied)

Immediately before execution, re-read provider and service-account policy and
stop if they differ from the evidence above. Capture those non-secret JSON
responses as rollback records. Do not overwrite a complete IAM policy.

1. Replace provider audience and exact subject condition in one update. Mapping,
   issuer, pool, service account and bucket settings remain as inspected.

```sh
gcloud iam workload-identity-pools providers update-oidc vercel \
  --workload-identity-pool=adstudio-vercel \
  --location=global \
  --project=project-eda6605c-73e6-4361-9ad \
  --allowed-audiences=https://vercel.com/love-strings-dashboard \
  --attribute-condition="assertion.sub == 'owner:love-strings-dashboard:project:love-strings-dashboard:environment:production'"
```

2. Add the matching exact production principal to the existing workload role.

```sh
gcloud iam service-accounts add-iam-policy-binding adstudio-service@project-eda6605c-73e6-4361-9ad.iam.gserviceaccount.com \
  --project=project-eda6605c-73e6-4361-9ad \
  --role=roles/iam.workloadIdentityUser \
  --member=principal://iam.googleapis.com/projects/1023633877337/locations/global/workloadIdentityPools/adstudio-vercel/subject/owner:love-strings-dashboard:project:love-strings-dashboard:environment:production \
  --condition=None
```

3. Remove only the stale principal's workload binding. Preserve the service
   account's existing self `roles/iam.serviceAccountTokenCreator` binding.

```sh
gcloud iam service-accounts remove-iam-policy-binding adstudio-service@project-eda6605c-73e6-4361-9ad.iam.gserviceaccount.com \
  --project=project-eda6605c-73e6-4361-9ad \
  --role=roles/iam.workloadIdentityUser \
  --member=principal://iam.googleapis.com/projects/1023633877337/locations/global/workloadIdentityPools/adstudio-vercel/subject/owner:lovestrings-dev:project:love-strings-dashboard:environment:production \
  --condition=None
```

Re-read both resources after each mutation. Confirm a single exact production
subject, no wildcard/pool-wide trust, original issuer/mapping, and unchanged
self token-creator binding. Allow for IAM propagation before interpreting a
retry as another defect.

## Verification after approval

Use the existing authenticated Production app session:

1. Request a signed upload URL for a small portrait MP4. A sign-only request
   creates neither an object nor a metadata row. Do not print tokens or URLs.
2. Upload the MP4: verify successful signing, direct PUT, and one completion
   metadata row in that order.
3. Verify preview, refresh and the same asset/selection on another device in
   the same workspace. Repeat with a short iPhone MOV in Safari.
4. Verify another workspace cannot list or preview the first workspace's asset;
   verify viewer upload denial. Do not broaden trust if these checks fail.
5. Inspect CORS only if signing succeeds but direct PUT fails.

No successful upload or cross-device result is claimed by the policy repair.
Physical iPhone selection/verification may require the user's participation.

## Rollback

Reverse only these changes, using the fresh pre-change record as authority:
add back the old exact principal with `add-iam-policy-binding`; restore provider
`--allowed-audiences=https://vercel.com/lovestrings-dev` and
`--attribute-condition="assertion.sub == 'owner:lovestrings-dev:project:love-strings-dashboard:environment:production'"`;
remove the newly added principal with `remove-iam-policy-binding`.
Use the same project, pool, location, service account, role and
`--condition=None` shown above. Re-read both resources afterward.
This restores the audited, failing baseline; it does not make uploads work.

## References

- [Vercel OIDC claims and name changes](https://vercel.com/docs/oidc/reference)
- [Vercel GCP allowed-audience integration](https://vercel.com/docs/oidc/gcp)
- [Custom-audience exchange and issuer behavior](https://vercel.com/changelog/custom-oidc-token-audiences)
- [Original audit](studio-private-upload-oidc-handoff-2026-11-16.md)
