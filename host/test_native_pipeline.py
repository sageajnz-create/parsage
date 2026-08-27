import unittest

from native_pipeline import build_pipeline, build_webrtc_loopback_pipeline, capabilities


class NativePipelineTests(unittest.TestCase):
    def test_vaapi_pipeline_is_low_latency_and_bitrate_limited(self):
        pipeline = build_pipeline(7, "path", "42", "h264_vaapi", 25_000, 60)
        self.assertIn('pipewiresrc fd=7 path="42"', pipeline)
        self.assertIn("max-size-buffers=2 leaky=downstream", pipeline)
        self.assertIn("vah264enc bitrate=25000", pipeline)
        self.assertIn("target-usage=7", pipeline)
        self.assertIn("key-int-max=60", pipeline)

    def test_software_fallback_uses_zerolatency_mode(self):
        pipeline = build_pipeline(7, "target-object", "1001", "h264_software", 8_000, 30)
        self.assertIn("x264enc bitrate=8000", pipeline)
        self.assertIn("tune=zerolatency", pipeline)
        self.assertIn("bframes=0", pipeline)

    def test_probe_always_reports_required_capability_keys(self):
        report = capabilities()
        self.assertIn("pipewire_source", report)
        self.assertIn("webrtc_transport", report)
        self.assertIn("recommended_encoder", report)

    def test_webrtc_loopback_packetizes_and_receives_h264(self):
        pipeline = build_webrtc_loopback_pipeline(7, "path", "42", "h264_vaapi", 25_000, 60)
        self.assertIn("rtph264pay pt=96", pipeline)
        self.assertIn("webrtcbin name=sender", pipeline)
        self.assertIn("webrtcbin name=receiver", pipeline)
        self.assertIn("queue name=receive_queue", pipeline)
        self.assertIn("fakesink name=received", pipeline)


if __name__ == "__main__":
    unittest.main()
