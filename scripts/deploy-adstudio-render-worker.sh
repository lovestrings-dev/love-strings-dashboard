#!/usr/bin/env bash
set -euo pipefail

# One-time deployment helper. It deliberately does not accept a service-account
# key: Cloud Build and Cloud Run use Google-managed workload identity.
PROJECT_ID="project-eda6605c-73e6-4361-9ad"
PROJECT_NUMBER="1023633877337"
REGION="europe-west3"
REPOSITORY="adstudio"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/ffmpeg-renderer:latest"
JOB_NAME="adstudio-ffmpeg-renderer"
SERVICE_ACCOUNT="adstudio-service@$PROJECT_ID.iam.gserviceaccount.com"
STAGING_BUCKET="adstudio-staging-$PROJECT_NUMBER"
RENDER_BUCKET="adstudio-renders-$PROJECT_NUMBER"

# Staging holds third-party downloads and temporary manifests only. Keep it
# short-lived; final renders intentionally have no automatic deletion policy.
gcloud storage buckets update "gs://$STAGING_BUCKET" \
  --lifecycle-file=render-worker/staging-lifecycle.json \
  --project="$PROJECT_ID"

gcloud builds submit render-worker \
  --project="$PROJECT_ID" \
  --tag="$IMAGE"

gcloud run jobs deploy "$JOB_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE" \
  --service-account="$SERVICE_ACCOUNT" \
  --set-env-vars="STAGING_BUCKET=$STAGING_BUCKET,RENDER_BUCKET=$RENDER_BUCKET" \
  --tasks=1 \
  --max-retries=1 \
  --task-timeout=20m \
  --cpu=2 \
  --memory=4Gi \
  --command=python \
  --args=/app/renderer.py

echo "Deployed $JOB_NAME. A future authenticated API will execute it with:"
echo "gcloud run jobs execute $JOB_NAME --region=$REGION --args=--manifest-uri=gs://$STAGING_BUCKET/manifests/RENDER_ID.json"
