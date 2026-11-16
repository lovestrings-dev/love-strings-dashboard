import importlib.util
import os
import subprocess
import sys
import tempfile
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

    def test_rejects_nonfinite_or_fractional_duration_and_trim(self):
        for duration in (True, float("inf"), 2.7):
            data = self.payload()
            data["duration_seconds"] = duration
            with self.assertRaises(renderer.RenderError):
                renderer.RenderManifest.from_json(data, "stage", "render")
        for start, end in ((float("nan"), 2), (3, 2), (None, 4), (-1, 2)):
            data = self.payload()
            data.update(video_start_seconds=start, video_end_seconds=end)
            with self.assertRaises(renderer.RenderError):
                renderer.RenderManifest.from_json(data, "stage", "render")

    def test_trims_then_loops_only_selected_video_and_seeks_audio(self):
        data = self.payload()
        data.update(audio_start_seconds=10, audio_end_seconds=30, video_start_seconds=2, video_end_seconds=5)
        manifest = renderer.RenderManifest.from_json(data, "stage", "render")
        normalize, final = renderer.build_render_commands(manifest, Path("/tmp/test"), 10, 60)
        self.assertEqual(normalize[normalize.index("-ss") + 1], "2.0")
        self.assertEqual(normalize[normalize.index("-t") + 1], "3.0")
        self.assertEqual(final[final.index("-stream_loop") + 1], "-1")
        self.assertEqual(final[final.index("-i") + 1], "/tmp/test/video-snippet.mp4")
        self.assertEqual(final[final.index("-ss") + 1], "10.0")
        self.assertEqual(final[final.index("-map", final.index("-map") + 1) + 1], "1:a:0")
        self.assertNotIn("-shortest", final)
        self.assertEqual(final[final.index("-t") + 1], "20")

    def test_rejects_trim_past_real_source_or_short_audio(self):
        data = self.payload()
        data.update(video_start_seconds=2, video_end_seconds=5)
        manifest = renderer.RenderManifest.from_json(data, "stage", "render")
        with self.assertRaises(renderer.RenderError):
            renderer.build_render_commands(manifest, Path("/tmp/test"), 4, 60)
        with self.assertRaises(renderer.RenderError):
            renderer.build_render_commands(manifest, Path("/tmp/test"), 10, 3)


@unittest.skipUnless(os.environ.get("FFMPEG_TEST_BINARY"), "Set FFMPEG_TEST_BINARY for synthetic-media integration")
class RenderExecutionTests(unittest.TestCase):
    def test_trimmed_blue_segment_repeats_to_output_duration(self):
        binary = os.environ["FFMPEG_TEST_BINARY"]
        with tempfile.TemporaryDirectory(prefix="studio-render-test-") as directory:
            root = Path(directory)
            base = [binary, "-y", "-hide_banner", "-loglevel", "error"]
            subprocess.run(base + ["-f", "lavfi", "-i", "color=red:s=64x128:d=1:r=30", "-f", "lavfi", "-i", "color=blue:s=64x128:d=1:r=30", "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264", "-f", "mp4", str(root / "source-video")], check=True)
            subprocess.run(base + ["-f", "lavfi", "-i", "sine=frequency=440:duration=5", "-c:a", "aac", "-f", "mp4", str(root / "source-audio")], check=True)
            data = {"render_id": "test", "video_uri": "gs://stage/video", "audio_uri": "gs://stage/audio", "output_uri": "gs://renders/final.mp4", "duration_seconds": 3, "video_start_seconds": 1, "video_end_seconds": 2, "audio_start_seconds": 1, "audio_end_seconds": 4}
            manifest = renderer.RenderManifest.from_json(data, "stage", "renders")
            for command in renderer.build_render_commands(manifest, root, 2, 5):
                subprocess.run([binary, *command[1:]], check=True, timeout=120)
            result = subprocess.run([binary, "-hide_banner", "-i", str(root / "render.mp4"), "-f", "null", "-"], check=True, capture_output=True, text=True)
            self.assertRegex(result.stderr, r"Duration: 00:00:03\.0")
            self.assertIn("Audio: aac", result.stderr)
            pixel = subprocess.run(base + ["-ss", "2.5", "-i", str(root / "render.mp4"), "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], check=True, capture_output=True).stdout
            self.assertEqual(len(pixel), 3)
            self.assertGreater(pixel[2], pixel[0] + 100, "Looped output must retain only the selected blue segment")


if __name__ == "__main__":
    unittest.main()
