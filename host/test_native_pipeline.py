import unittest
from unittest.mock import patch

from native_pipeline import (
    build_encoding_chain,
    build_pipeline,
    build_webrtc_loopback_pipeline,
    capabilities,
    choose_peer_encoder,
    require_native_runtime,
)


class NativePipelineTests(unittest.TestCase):
    def test_vaapi_pipeline_is_low_latency_and_bitrate_limited(self):
        pipeline = build_pipeline(7, "path", "42", "h264_vaapi", 25_000, 60)
        self.assertIn('pipewiresrc fd=7 path="42"', pipeline)
        self.assertIn("max-size-buffers=2 leaky=downstream", pipeline)
        self.assertIn("vah264enc name=video_encoder bitrate=25000", pipeline)
        self.assertIn("identity name=captured", pipeline)
        self.assertIn("identity name=pre_encode", pipeline)
        self.assertIn("target-usage=7", pipeline)
        self.assertIn("key-int-max=60", pipeline)

    def test_software_fallback_uses_zerolatency_mode(self):
        pipeline = build_pipeline(7, "target-object", "1001", "h264_software", 8_000, 30)
        self.assertIn("x264enc name=video_encoder bitrate=8000", pipeline)
        self.assertIn("tune=zerolatency", pipeline)
        self.assertIn("bframes=0", pipeline)

    def test_probe_always_reports_required_capability_keys(self):
        report = capabilities()
        self.assertIn("pipewire_source", report)
        self.assertIn("webrtc_transport", report)
        self.assertIn("recommended_encoder", report)

    def test_probe_degrades_cleanly_without_native_runtime(self):
        with patch("native_pipeline.Gst", None):
            report = capabilities()
        self.assertFalse(report["pipewire_source"])
        self.assertFalse(report["webrtc_transport"])
        self.assertIsNone(report["recommended_encoder"])

    def test_native_commands_explain_missing_runtime(self):
        with patch("native_pipeline.Gst", None):
            with self.assertRaisesRegex(RuntimeError, "Native media runtime unavailable"):
                require_native_runtime()

    def test_webrtc_loopback_packetizes_and_receives_h264(self):
        pipeline = build_webrtc_loopback_pipeline(7, "path", "42", "h264_vaapi", 25_000, 60)
        self.assertIn("rtph264pay name=payloader pt=96", pipeline)
        self.assertIn("queue name=pacer", pipeline)
        self.assertIn("webrtcbin name=sender", pipeline)
        self.assertIn("webrtcbin name=receiver", pipeline)
        self.assertIn("queue name=receive_queue", pipeline)
        self.assertIn("fakesink name=received", pipeline)

    def test_live_peer_chain_is_h264_ready_for_webrtc_packetization(self):
        chain = build_encoding_chain(7, "path", "42", "h264_vaapi", 12_000, 60)
        self.assertIn("pipewiresrc", chain)
        self.assertIn("vah264enc name=video_encoder bitrate=12000", chain)
        self.assertTrue(chain.rstrip().endswith("! h264parse"))

    def test_hevc_chain_is_built_only_for_hevc_encoder(self):
        chain = build_encoding_chain(7, "path", "42", "hevc_vaapi", 12_000, 60)
        self.assertIn("vah265enc name=video_encoder bitrate=12000", chain)
        self.assertIn("h265parse", chain)
        self.assertNotIn("vah264enc", chain)

    def test_pacing_queue_sits_in_front_of_rtp(self):
        from native_pipeline import pacing_payloader_fragment
        fragment = pacing_payloader_fragment("h264_vaapi")
        self.assertIn("queue name=pacer max-size-buffers=2 leaky=downstream", fragment)
        self.assertIn("rtph264pay name=payloader", fragment)

    def test_probe_lists_optional_hevc_and_av1_encoders(self):
        report = capabilities()
        self.assertIn("hevc_vaapi", report["encoders"])
        self.assertIn("av1_vaapi", report["encoders"])
        self.assertIn("advertised_codecs", report)

    def test_auto_encoder_stays_on_h264_until_viewer_advertises_hevc(self):
        class Args:
            test_source = False
            encoder = "auto"
            remote_codecs = ""
            preference = "hevc"

        caps = {
            "encoders": {
                "h264_vaapi": True,
                "h264_software": True,
                "hevc_vaapi": True,
                "hevc_software": False,
                "av1_vaapi": False,
                "av1_software": False,
            }
        }
        encoder, negotiated = choose_peer_encoder(Args(), caps)
        self.assertEqual(encoder, "h264_vaapi")
        self.assertEqual(negotiated, ["h264"])

        Args.remote_codecs = "h264,hevc"
        encoder, negotiated = choose_peer_encoder(Args(), caps)
        self.assertEqual(encoder, "hevc_vaapi")
        self.assertEqual(negotiated[0], "hevc")


if __name__ == "__main__":
    unittest.main()
