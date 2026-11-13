# ArtistDeck Studio render worker

This folder builds the FFmpeg engine for ArtistDeck Studio. It is a Cloud Run
**Job**, not a public HTTP service.

## Security boundary

- Input video, audio, optional cover image, and render manifest live in the
  private staging bucket.
- Output is written only to the private render bucket.
- The worker authenticates with `adstudio-service`'s Cloud Run workload identity.
- There are no JSON service-account keys, public buckets, public object ACLs, or
  customer URLs in a manifest.
- The app layer is responsible for authorising a user, copying Pexels/video
  assets to staging, creating the manifest, and issuing a short-lived signed
  URL only after a render completes.

## Manifest contract

Save a manifest under `gs://adstudio-staging-1023633877337/manifests/<render-id>.json`.
`render-request.example.json` documents the supported first-release fields.

The worker validates the buckets, bounded duration (1–180 seconds), `render_id`,
MP4 output suffix, overlay position, colour, and text length before it downloads
media or invokes FFmpeg. The final output is H.264/AAC, 1080×1920 vertical MP4,
with `faststart` metadata for browser playback.

## Build and deploy

From the repository root, once the source files are reviewed:

```bash
bash scripts/deploy-adstudio-render-worker.sh
```

The deployment script builds through Cloud Build and deploys a single Frankfurt
Cloud Run Job, and applies a 7-day deletion policy to temporary `media/` and
`manifests/` staging objects. It does not execute a render. A render later runs one isolated
job execution with `--manifest-uri` pointing to its private manifest.

## Local checks

```bash
python3 -m unittest render-worker/tests/test_renderer.py
```

Local rendering needs Application Default Credentials that can read/write the
same buckets. The worker itself never needs a downloaded key file.
