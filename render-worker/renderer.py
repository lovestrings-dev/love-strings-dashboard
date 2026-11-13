#!/usr/bin/env python3
"""ArtistDeck Studio's private Cloud Run Job FFmpeg renderer.

Each Cloud Run execution receives exactly one manifest stored in the private
staging bucket. The worker reads only GCS objects using its workload identity,
renders in /tmp, and writes one MP4 to the private render bucket. No bucket is
made public and no long-lived Google credential is needed in this image.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from google.cloud import storage

LOG = logging.getLogger("adstudio.renderer")
MAX_TEXT_LENGTH = 280
MAX_DURATION_SECONDS = 180
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class RenderError(ValueError):
    """A manifest cannot be safely rendered."""


def parse_gcs_uri(uri: str) -> tuple[str, str]:
    parsed = urlparse(uri)
    if parsed.scheme != "gs" or not parsed.netloc or not parsed.path.lstrip("/"):
        raise RenderError(f"Expected a GCS object URI, got: {uri!r}")
    return parsed.netloc, parsed.path.lstrip("/")


def ensure_bucket(uri: str, expected_bucket: str, field: str) -> None:
    bucket, _ = parse_gcs_uri(uri)
    if bucket != expected_bucket:
        raise RenderError(f"{field} must be in gs://{expected_bucket}")


def ffmpeg_escape(value: str) -> str:
    """Escape an ffmpeg filter-value without invoking a shell."""
    return value.replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:").replace(",", "\\,")


@dataclass(frozen=True)
class Overlay:
    image_uri: str | None
    text: str | None
    text_color: str
    font_size: int
    position: str


@dataclass(frozen=True)
class RenderManifest:
    render_id: str
    video_uri: str
    audio_uri: str
    output_uri: str
    duration_seconds: int
    overlay: Overlay

    @classmethod
    def from_json(cls, payload: dict[str, Any], staging_bucket: str, render_bucket: str) -> "RenderManifest":
        required = ("render_id", "video_uri", "audio_uri", "output_uri", "duration_seconds")
        absent = [key for key in required if key not in payload]
        if absent:
            raise RenderError(f"Manifest missing: {', '.join(absent)}")

        render_id = str(payload["render_id"])
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,96}", render_id):
            raise RenderError("render_id must contain only letters, numbers, _ or -")
        duration = int(payload["duration_seconds"])
        if duration < 1 or duration > MAX_DURATION_SECONDS:
            raise RenderError(f"duration_seconds must be between 1 and {MAX_DURATION_SECONDS}")

        video_uri, audio_uri, output_uri = map(str, (payload["video_uri"], payload["audio_uri"], payload["output_uri"]))
        ensure_bucket(video_uri, staging_bucket, "video_uri")
        ensure_bucket(audio_uri, staging_bucket, "audio_uri")
        ensure_bucket(output_uri, render_bucket, "output_uri")
        if not output_uri.endswith(".mp4"):
            raise RenderError("output_uri must end in .mp4")

        raw_overlay = payload.get("overlay") or {}
        if not isinstance(raw_overlay, dict):
            raise RenderError("overlay must be an object")
        image_uri = raw_overlay.get("image_uri")
        if image_uri is not None:
            image_uri = str(image_uri)
            ensure_bucket(image_uri, staging_bucket, "overlay.image_uri")
        text = raw_overlay.get("text")
        if text is not None:
            text = str(text).strip()
            if len(text) > MAX_TEXT_LENGTH:
                raise RenderError(f"overlay.text must not exceed {MAX_TEXT_LENGTH} characters")
            if any(ord(character) < 32 for character in text):
                raise RenderError("overlay.text must not contain control characters")
        text_color = str(raw_overlay.get("text_color", "#ffffff"))
        if not HEX_COLOR.fullmatch(text_color):
            raise RenderError("overlay.text_color must be a six-digit hex color")
        font_size = int(raw_overlay.get("font_size", 58))
        if font_size < 12 or font_size > 160:
            raise RenderError("overlay.font_size must be between 12 and 160")
        position = str(raw_overlay.get("position", "bottom"))
        if position not in {"top", "center", "bottom"}:
            raise RenderError("overlay.position must be top, center, or bottom")

        return cls(render_id, video_uri, audio_uri, output_uri, duration, Overlay(image_uri, text, text_color, font_size, position))


def download(client: storage.Client, uri: str, destination: Path) -> None:
    bucket_name, object_name = parse_gcs_uri(uri)
    LOG.info("Downloading gs://%s/%s", bucket_name, object_name)
    client.bucket(bucket_name).blob(object_name).download_to_filename(destination)


def upload(client: storage.Client, source: Path, uri: str, render_id: str) -> None:
    bucket_name, object_name = parse_gcs_uri(uri)
    blob = client.bucket(bucket_name).blob(object_name)
    blob.metadata = {"render_id": render_id, "generator": "adstudio-ffmpeg"}
    blob.upload_from_filename(source, content_type="video/mp4")
    LOG.info("Uploaded gs://%s/%s", bucket_name, object_name)


def build_filter(overlay: Overlay) -> tuple[list[str], str]:
    # H.264 1080x1920 output works in Meta, Reels, TikTok, and browser preview.
    filters = ["[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[base]"]
    current = "[base]"
    input_args: list[str] = []

    if overlay.image_uri:
        filters.append(f"{current}[1:v]overlay=(W-w)/2:(H-h)/2:format=auto[image]")
        current = "[image]"
    if overlay.text:
        y = {"top": "120", "center": "(h-text_h)/2", "bottom": "h-text_h-160"}[overlay.position]
        filters.append(
            f"{current}drawtext=text='{ffmpeg_escape(overlay.text)}':fontcolor={overlay.text_color}:"
            f"fontsize={overlay.font_size}:x=(w-text_w)/2:y={y}:expansion=none:box=1:boxcolor=black@0.42:boxborderw=22[text]"
        )
        current = "[text]"
    return input_args, ";".join(filters) + f";{current}null[outv]"


def render(manifest: RenderManifest, work_dir: Path) -> Path:
    video = work_dir / "source-video"
    audio = work_dir / "source-audio"
    overlay_image = work_dir / "overlay-image"
    output = work_dir / "render.mp4"
    client = storage.Client()
    download(client, manifest.video_uri, video)
    download(client, manifest.audio_uri, audio)
    if manifest.overlay.image_uri:
        download(client, manifest.overlay.image_uri, overlay_image)

    _, filter_complex = build_filter(manifest.overlay)
    command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(video)]
    if manifest.overlay.image_uri:
        command += ["-loop", "1", "-i", str(overlay_image)]
    command += ["-i", str(audio), "-filter_complex", filter_complex, "-map", "[outv]", "-map", f"{2 if manifest.overlay.image_uri else 1}:a:0"]
    command += ["-t", str(manifest.duration_seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", str(output)]
    LOG.info("Starting render %s", manifest.render_id)
    subprocess.run(command, check=True)
    if not output.exists() or output.stat().st_size == 0:
        raise RuntimeError("ffmpeg completed without producing an MP4")
    upload(client, output, manifest.output_uri, manifest.render_id)
    return output


def load_manifest(client: storage.Client, uri: str, staging_bucket: str) -> dict[str, Any]:
    ensure_bucket(uri, staging_bucket, "manifest URI")
    bucket_name, object_name = parse_gcs_uri(uri)
    raw = client.bucket(bucket_name).blob(object_name).download_as_text()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RenderError("manifest is not valid JSON") from error
    if not isinstance(parsed, dict):
        raise RenderError("manifest root must be an object")
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(description="Render one ArtistDeck Studio manifest")
    parser.add_argument("--manifest-uri", required=True, help="Private gs:// URI in the staging bucket")
    args = parser.parse_args()
    staging_bucket = os.environ.get("STAGING_BUCKET", "")
    render_bucket = os.environ.get("RENDER_BUCKET", "")
    if not staging_bucket or not render_bucket:
        raise RenderError("STAGING_BUCKET and RENDER_BUCKET environment variables are required")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    client = storage.Client()
    manifest = RenderManifest.from_json(load_manifest(client, args.manifest_uri, staging_bucket), staging_bucket, render_bucket)
    with tempfile.TemporaryDirectory(prefix=f"adstudio-{manifest.render_id}-") as directory:
        render(manifest, Path(directory))
    LOG.info("Render %s completed", manifest.render_id)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RenderError, subprocess.CalledProcessError, OSError) as error:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
        LOG.exception("Render failed: %s", error)
        raise SystemExit(1)
