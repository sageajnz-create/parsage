"""Shared rules for native video codecs, bitrate, and keyframe recovery.

H.264 is the baseline. HEVC and AV1 are added only when both sides say they
support that codec. Bitrate starts at the host ceiling and drops when packet
loss is high, then climbs slowly when the path is clean. A hard loss spike
also asks for a new keyframe so the viewer can recover quickly.
"""

VIDEO_CODECS = ("h264", "hevc", "av1")

CODEC_ENCODERS = {
    "h264": ("h264_vaapi", "h264_software"),
    "hevc": ("hevc_vaapi", "hevc_software"),
    "av1": ("av1_vaapi", "av1_software"),
}

MIN_BITRATE_MBPS = 2.0
HARD_LOSS_RATIO = 0.05
SOFT_LOSS_RATIO = 0.02
RECOVER_LOSS_RATIO = 0.005
DOWN_HARD = 0.70
DOWN_SOFT = 0.85
UP_STEP = 1.05
KEYFRAME_COOLDOWN_FRAMES = 30


def normalize_codec_name(name):
    """Map SDP or UI names onto h264, hevc, or av1."""
    if not isinstance(name, str):
        return None
    token = name.strip().lower().replace("video/", "").replace(".", "")
    if token in {"h264", "avc", "avc1"}:
        return "h264"
    if token in {"h265", "hevc", "hev1", "hvc1"}:
        return "hevc"
    if token in {"av1", "av01"}:
        return "av1"
    return None


def advertised_codecs_from_names(names):
    """Return unique codecs from a list of SDP or UI names, H.264 first."""
    found = []
    for name in names or []:
        codec = normalize_codec_name(name)
        if codec and codec not in found:
            found.append(codec)
    return [codec for codec in VIDEO_CODECS if codec in found]


def codecs_from_sdp(sdp_text):
    """Read advertised video codecs from an SDP blob."""
    names = []
    if not isinstance(sdp_text, str):
        return []
    for line in sdp_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("a=rtpmap:"):
            parts = stripped.split()
            if len(parts) >= 2:
                names.append(parts[1].split("/")[0])
        elif stripped.startswith("a=fmtp:") and "profile-level-id" in stripped.lower():
            names.append("h264")
    return advertised_codecs_from_names(names)


def negotiate_video_codecs(local_codecs, remote_codecs=None, preference="h264"):
    """Pick an ordered codec list.

    H.264 stays first whenever both sides have it (or the remote list is
    still unknown). HEVC and AV1 are appended only when both sides listed
    them. A host/viewer preference may move HEVC or AV1 to the front, but
    only if both sides advertised that codec. VP8/VP9 are never selected.
    """
    local = advertised_codecs_from_names(local_codecs)
    remote = None if remote_codecs is None else advertised_codecs_from_names(remote_codecs)
    preferred = normalize_codec_name(preference) or "h264"

    def allowed(codec):
        if codec not in local:
            return False
        if remote is None:
            return codec == "h264"
        return codec in remote

    ordered = []
    if preferred in {"hevc", "av1"} and allowed(preferred):
        ordered.append(preferred)
    if allowed("h264") and "h264" not in ordered:
        ordered.append("h264")
    if remote is not None:
        for codec in ("hevc", "av1"):
            if allowed(codec) and codec not in ordered:
                ordered.append(codec)
    if ordered:
        return ordered
    if "h264" in local:
        return ["h264"]
    return local[:1]


def select_encoder(encoders, remote_codecs=None, preference="h264"):
    """Choose a concrete GStreamer encoder from negotiated codecs."""
    available = encoders or {}
    local_codecs = [
        codec for codec, names in CODEC_ENCODERS.items()
        if any(available.get(name) for name in names)
    ]
    negotiated = negotiate_video_codecs(local_codecs, remote_codecs, preference)
    if not negotiated:
        return None, []
    for codec in negotiated:
        for encoder_name in CODEC_ENCODERS[codec]:
            if available.get(encoder_name):
                return encoder_name, negotiated
    return None, negotiated


def encoder_codec_family(encoder):
    """Return h264, hevc, or av1 for a concrete encoder name."""
    for codec, names in CODEC_ENCODERS.items():
        if encoder in names or encoder == codec:
            return codec
    return None


def rtp_encoding_name(encoder):
    family = encoder_codec_family(encoder)
    return {"h264": "H264", "hevc": "H265", "av1": "AV1"}.get(family)


def clamp_bitrate_mbps(value, ceiling_mbps):
    ceiling = max(float(ceiling_mbps), MIN_BITRATE_MBPS)
    floor = max(MIN_BITRATE_MBPS, ceiling * 0.2)
    try:
        bitrate = float(value)
    except (TypeError, ValueError):
        bitrate = ceiling
    return max(floor, min(ceiling, bitrate))


def next_bitrate_mbps(current_mbps, ceiling_mbps, loss_ratio):
    """Return (new_bitrate_mbps, request_keyframe) from a one-second loss sample."""
    ceiling = max(float(ceiling_mbps), MIN_BITRATE_MBPS)
    current = clamp_bitrate_mbps(current_mbps, ceiling)
    try:
        loss = max(0.0, float(loss_ratio))
    except (TypeError, ValueError):
        loss = 0.0

    if loss >= HARD_LOSS_RATIO:
        return clamp_bitrate_mbps(current * DOWN_HARD, ceiling), True
    if loss >= SOFT_LOSS_RATIO:
        return clamp_bitrate_mbps(current * DOWN_SOFT, ceiling), False
    if loss <= RECOVER_LOSS_RATIO:
        return clamp_bitrate_mbps(current * UP_STEP, ceiling), False
    return current, False


def should_force_keyframe(loss_ratio, frames_since_keyframe, frames_decoded_delta=None):
    """True when loss is hard or the viewer stopped producing frames."""
    try:
        loss = max(0.0, float(loss_ratio))
    except (TypeError, ValueError):
        loss = 0.0
    if frames_since_keyframe < KEYFRAME_COOLDOWN_FRAMES:
        return False
    if loss >= HARD_LOSS_RATIO:
        return True
    if frames_decoded_delta is not None and frames_decoded_delta <= 0 and loss > 0:
        return True
    return False


def loss_ratio(packets_lost_delta, packets_sent_or_received_delta):
    """Lost / (lost + received_or_sent). Zero when there is no sample."""
    try:
        lost = max(0, int(packets_lost_delta))
        total = max(0, int(packets_sent_or_received_delta))
    except (TypeError, ValueError):
        return 0.0
    observed = lost + total
    if observed <= 0:
        return 0.0
    return lost / observed


def dominant_latency_stage(stages_ms):
    """Name the slowest measured stage. Missing (None) stages are ignored."""
    measured = {
        name: value
        for name, value in (stages_ms or {}).items()
        if isinstance(value, (int, float)) and value >= 0
    }
    if not measured:
        return None
    return max(measured, key=measured.get)
