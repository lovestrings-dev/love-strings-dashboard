import importlib.util
import sys
import types
import unittest
from pathlib import Path

# Keep the manifest-contract tests dependency-free. The production container
# installs google-cloud-storage; these tests exercise validation before any
# Cloud Storage client is created.
google = types.ModuleType("google")
google_cloud = types.ModuleType("google.cloud")
google_storage = types.ModuleType("google.cloud.storage")
google_storage.Client = object
sys.modules.setdefault("google", google)
sys.modules.setdefault("google.cloud", google_cloud)
sys.modules.setdefault("google.cloud.storage", google_storage)

SPEC = importlib.util.spec_from_file_location("renderer", Path(__file__).parents[1] / "renderer.py")
renderer = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules["renderer"] = renderer
SPEC.loader.exec_module(renderer)


class ManifestValidationTests(unittest.TestCase):
    def payload(self):
        return {
            "render_id": "safe_render-1",
            "video_uri": "gs://stage/video.mp4",
            "audio_uri": "gs://stage/audio.mp3",
            "output_uri": "gs://render/renders/safe_render-1/final.mp4",
            "duration_seconds": 20,
            "overlay": {"text": "Hello", "text_color": "#ffffff", "position": "bottom"},
        }

    def test_accepts_private_bucket_manifest(self):
        manifest = renderer.RenderManifest.from_json(self.payload(), "stage", "render")
        self.assertEqual(manifest.duration_seconds, 20)

    def test_rejects_output_outside_render_bucket(self):
        data = self.payload()
        data["output_uri"] = "gs://stage/not-allowed.mp4"
        with self.assertRaises(renderer.RenderError):
            renderer.RenderManifest.from_json(data, "stage", "render")

    def test_rejects_ffmpeg_text_too_long(self):
        data = self.payload()
        data["overlay"]["text"] = "x" * 281
        with self.assertRaises(renderer.RenderError):
            renderer.RenderManifest.from_json(data, "stage", "render")

    def test_rejects_control_characters_in_overlay_text(self):
        data = self.payload()
        data["overlay"]["text"] = "unsafe\ntext"
        with self.assertRaises(renderer.RenderError):
            renderer.RenderManifest.from_json(data, "stage", "render")


if __name__ == "__main__":
    unittest.main()
