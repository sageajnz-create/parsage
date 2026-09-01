import unittest

from media_adapt import (
    advertised_codecs_from_names,
    codecs_from_sdp,
    dominant_latency_stage,
    encoder_codec_family,
    loss_ratio,
    negotiate_video_codecs,
    next_bitrate_mbps,
    rtp_encoding_name,
    select_encoder,
    should_force_keyframe,
)


class CodecNegotiationTests(unittest.TestCase):
    def test_h264_is_used_when_remote_has_not_advertised_yet(self):
        self.assertEqual(
            negotiate_video_codecs(["h264", "hevc", "av1"], None),
            ["h264"],
        )

    def test_hevc_and_av1_require_both_peers(self):
        self.assertEqual(
            negotiate_video_codecs(["h264", "hevc", "av1"], ["h264"]),
            ["h264"],
        )
        self.assertEqual(
            negotiate_video_codecs(["h264", "hevc"], ["h264", "hevc", "av1"]),
            ["h264", "hevc"],
        )
        self.assertEqual(
            negotiate_video_codecs(["h264", "av1"], ["h264", "av1"]),
            ["h264", "av1"],
        )

    def test_preference_cannot_select_unadvertised_hevc(self):
        self.assertEqual(
            negotiate_video_codecs(["h264", "hevc"], ["h264"], preference="hevc"),
            ["h264"],
        )

    def test_shared_hevc_preference_wins_but_keeps_h264_fallback(self):
        self.assertEqual(
            negotiate_video_codecs(
                ["h264", "hevc", "av1"], ["h264", "hevc"], preference="hevc"
            ),
            ["hevc", "h264"],
        )

    def test_sdp_parser_reads_rtpmap_codecs(self):
        sdp = "\n".join([
            "m=video 9 UDP/TLS/RTP/SAVPF 96 97 98",
            "a=rtpmap:96 H264/90000",
            "a=rtpmap:97 H265/90000",
            "a=rtpmap:98 AV1/90000",
            "a=rtpmap:99 VP8/90000",
        ])
        self.assertEqual(codecs_from_sdp(sdp), ["h264", "hevc", "av1"])

    def test_selects_vaapi_h264_before_software(self):
        encoder, negotiated = select_encoder(
            {"h264_vaapi": True, "h264_software": True, "hevc_vaapi": True},
            ["h264"],
        )
        self.assertEqual(encoder, "h264_vaapi")
        self.assertEqual(negotiated, ["h264"])

    def test_selects_hevc_only_when_both_advertise(self):
        encoder, negotiated = select_encoder(
            {"h264_software": True, "hevc_vaapi": True},
            ["h264", "hevc"],
            preference="hevc",
        )
        self.assertEqual(encoder, "hevc_vaapi")
        self.assertEqual(negotiated[0], "hevc")
        self.assertEqual(encoder_codec_family(encoder), "hevc")
        self.assertEqual(rtp_encoding_name(encoder), "H265")

    def test_ui_and_mime_names_normalize(self):
        self.assertEqual(
            advertised_codecs_from_names(["video/H264", "H.265", "AV1"]),
            ["h264", "hevc", "av1"],
        )


class BitrateAndKeyframeTests(unittest.TestCase):
    def test_hard_loss_cuts_bitrate_and_asks_for_keyframe(self):
        bitrate, keyframe = next_bitrate_mbps(20, 25, 0.08)
        self.assertLess(bitrate, 20)
        self.assertTrue(keyframe)

    def test_clean_path_climbs_toward_ceiling(self):
        bitrate, keyframe = next_bitrate_mbps(10, 25, 0.0)
        self.assertGreater(bitrate, 10)
        self.assertLessEqual(bitrate, 25)
        self.assertFalse(keyframe)

    def test_bitrate_never_exceeds_ceiling_or_floor(self):
        high, _ = next_bitrate_mbps(25, 25, 0.0)
        self.assertEqual(high, 25)
        low, _ = next_bitrate_mbps(2, 25, 0.5)
        self.assertGreaterEqual(low, 2)

    def test_keyframe_cooldown_avoids_spam(self):
        self.assertFalse(should_force_keyframe(0.2, frames_since_keyframe=5))
        self.assertTrue(should_force_keyframe(0.2, frames_since_keyframe=60))

    def test_stalled_decode_requests_keyframe_when_lossy(self):
        self.assertTrue(should_force_keyframe(0.01, 60, frames_decoded_delta=0))
        self.assertFalse(should_force_keyframe(0.0, 60, frames_decoded_delta=0))

    def test_loss_ratio_uses_lost_plus_delivered(self):
        self.assertAlmostEqual(loss_ratio(5, 95), 0.05)
        self.assertEqual(loss_ratio(0, 0), 0.0)

    def test_dominant_stage_picks_the_slowest_measured_value(self):
        self.assertEqual(
            dominant_latency_stage({
                "capture": 2.1,
                "encode": 4.8,
                "network": 18.0,
                "decode": 3.2,
                "present": 6.0,
            }),
            "network",
        )
        self.assertIsNone(dominant_latency_stage({"encode": None}))


if __name__ == "__main__":
    unittest.main()
