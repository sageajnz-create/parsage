#!/usr/bin/env python3
"""Portal-authorized PipeWire capture and low-latency encoder benchmark."""

import argparse
import json
import os
import sys
import threading
import time

try:
    import gi

    gi.require_version("Gst", "1.0")
    gi.require_version("GstSdp", "1.0")
    gi.require_version("GstWebRTC", "1.0")
    gi.require_version("Xdp", "1.0")
    from gi.repository import GLib, Gst, GstSdp, GstWebRTC, Xdp
except (ImportError, ValueError) as error:
    # Keep pipeline construction and capability probing available on developer
    # machines that do not have the Linux multimedia stack installed.
    GLib = Gst = GstSdp = GstWebRTC = Xdp = None
    NATIVE_IMPORT_ERROR = error
else:
    NATIVE_IMPORT_ERROR = None


NATIVE_ERRORS = (RuntimeError,) if GLib is None else (RuntimeError, GLib.Error)


def require_native_runtime():
    if all(component is not None for component in (GLib, Gst, GstSdp, GstWebRTC, Xdp)):
        return
    detail = f" ({NATIVE_IMPORT_ERROR})" if NATIVE_IMPORT_ERROR else ""
    raise RuntimeError(
        "Native media runtime unavailable. Install PyGObject, GStreamer, "
        f"GstSdp, GstWebRTC, and libportal GObject bindings{detail}."
    )


def element_available(name):
    return Gst is not None and Gst.ElementFactory.find(name) is not None


def capabilities():
    if Gst is not None:
        Gst.init(None)
    encoders = {
        "h264_vaapi": element_available("vah264enc"),
        "hevc_vaapi": element_available("vah265enc"),
        "h264_software": element_available("x264enc"),
    }
    return {
        "pipewire_source": element_available("pipewiresrc"),
        "webrtc_transport": element_available("webrtcbin"),
        "encoders": encoders,
        "render_node": next(
            (path for path in ("/dev/dri/renderD128", "/dev/dri/renderD129") if os.path.exists(path)),
            None,
        ),
        "recommended_encoder": (
            "h264_vaapi" if encoders["h264_vaapi"] else
            "h264_software" if encoders["h264_software"] else None
        ),
    }


class ScreenCastSession:
    def __init__(self):
        require_native_runtime()
        self.portal = Xdp.Portal.new()
        self.session = None
        self.fd = None

    def open(self, source_type=1, cursor_mode=2):
        loop = GLib.MainLoop()
        outcome = {}

        def created(portal, result, _data=None):
            try:
                outcome["session"] = portal.create_screencast_session_finish(result)
            except GLib.Error as error:
                outcome["error"] = error
            loop.quit()

        self.portal.create_screencast_session(
            Xdp.OutputType(source_type),
            Xdp.ScreencastFlags.NONE,
            Xdp.CursorMode(cursor_mode),
            Xdp.PersistMode.NONE,
            None,
            None,
            created,
            None,
        )
        loop.run()
        if outcome.get("error"):
            raise outcome["error"]
        self.session = outcome.get("session")
        if not self.session:
            raise RuntimeError("The portal did not create a screencast session")

        outcome.clear()

        def started(session, result, _data=None):
            try:
                outcome["started"] = session.start_finish(result)
            except GLib.Error as error:
                outcome["error"] = error
            loop.quit()

        self.session.start(None, None, started, None)
        loop.run()
        if outcome.get("error"):
            raise outcome["error"]
        if not outcome.get("started"):
            raise RuntimeError("The portal screencast session did not start")

        streams = self.session.get_streams().unpack()
        if not streams:
            raise RuntimeError("The portal returned no PipeWire streams")
        node_id, properties = streams[0]
        serial = properties.get("pipewire.serial")
        target_property = "target-object" if serial is not None else "path"
        target = serial if serial is not None else node_id
        self.fd = self.session.open_pipewire_remote()
        return self.fd, target_property, str(target)

    def close(self):
        if self.session:
            self.session.close()
            self.session = None
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None


def build_pipeline(fd, target_property, target, encoder, bitrate_kbps, fps):
    return build_encoding_chain(fd, target_property, target, encoder, bitrate_kbps, fps) + (
        "! fakesink name=encoded sync=false signal-handoffs=true"
    )


def build_encoding_chain(fd, target_property, target, encoder, bitrate_kbps, fps):
    source = (
        f'pipewiresrc fd={fd} {target_property}="{target}" do-timestamp=true '
        "! queue max-size-buffers=2 leaky=downstream "
        f"! videoconvert ! videorate ! video/x-raw,format=NV12,framerate={fps}/1 "
    )
    if encoder == "h264_vaapi":
        encoding = (
            f"! vah264enc bitrate={bitrate_kbps} rate-control=cbr target-usage=7 "
            f"key-int-max={fps} ! video/x-h264,profile=main "
        )
    elif encoder == "h264_software":
        encoding = (
            f"! x264enc bitrate={bitrate_kbps} speed-preset=ultrafast tune=zerolatency "
            f"key-int-max={fps} bframes=0 ! video/x-h264,profile=main "
        )
    else:
        raise ValueError(f"Unsupported encoder: {encoder}")
    return source + encoding + "! h264parse "


def build_webrtc_loopback_pipeline(fd, target_property, target, encoder, bitrate_kbps, fps):
    return add_webrtc_loopback(build_encoding_chain(
        fd, target_property, target, encoder, bitrate_kbps, fps
    ))


def add_webrtc_loopback(encoding_chain):
    return encoding_chain + (
        "! rtph264pay pt=96 config-interval=-1 aggregate-mode=zero-latency "
        "! application/x-rtp,media=video,encoding-name=H264,payload=96,clock-rate=90000 "
        "! webrtcbin name=sender bundle-policy=max-bundle "
        "webrtcbin name=receiver bundle-policy=max-bundle "
        "receiver. ! queue name=receive_queue ! fakesink name=received sync=false signal-handoffs=true"
    )


def emit_peer_message(message):
    print(json.dumps(message), flush=True)


def parse_session_description(kind, sdp_text):
    require_native_runtime()
    result, message = GstSdp.SDPMessage.new()
    if result != GstSdp.SDPResult.OK:
        raise RuntimeError("Could not allocate an SDP message")
    result = GstSdp.sdp_message_parse_buffer(sdp_text.encode("utf-8"), message)
    if result != GstSdp.SDPResult.OK:
        raise RuntimeError("Could not parse the remote SDP")
    sdp_type = (
        GstWebRTC.WebRTCSDPType.ANSWER if kind == "answer"
        else GstWebRTC.WebRTCSDPType.OFFER
    )
    return GstWebRTC.WebRTCSessionDescription.new(sdp_type, message)


def run_webrtc_peer(args):
    """Run one native H.264 sender controlled by newline-delimited JSON on stdio."""
    require_native_runtime()
    caps = capabilities()
    encoder = (
        "h264_software" if args.test_source else
        args.encoder if args.encoder != "auto" else caps["recommended_encoder"]
    )
    if not encoder or not caps["encoders"].get(encoder):
        raise RuntimeError(f"Encoder is unavailable: {encoder or 'none'}")

    session = None if args.test_source else ScreenCastSession()
    pipeline = None
    loop = GLib.MainLoop()
    try:
        if session:
            fd, target_property, target = session.open()
            chain = build_encoding_chain(
                fd, target_property, target, encoder, args.bitrate * 1000, args.fps
            )
        else:
            chain = (
                "videotestsrc is-live=true pattern=ball "
                f"! video/x-raw,width=1280,height=720,framerate={args.fps}/1 "
                "! videoconvert ! video/x-raw,format=NV12 "
                f"! x264enc bitrate={args.bitrate * 1000} speed-preset=ultrafast "
                f"tune=zerolatency key-int-max={args.fps} bframes=0 "
                "! video/x-h264,profile=main ! h264parse "
            )
        description = chain + (
            "! identity name=peer_encoded signal-handoffs=true "
            "! rtph264pay pt=96 config-interval=-1 aggregate-mode=zero-latency "
            "! application/x-rtp,media=video,encoding-name=H264,payload=96,clock-rate=90000 "
            "! webrtcbin name=sender bundle-policy=max-bundle"
        )
        pipeline = Gst.parse_launch(description)
        sender = pipeline.get_by_name("sender")
        encoded = pipeline.get_by_name("peer_encoded")
        peer_stats = {"encoded_frames": 0}

        def encoded_handoff(_identity, _buffer):
            peer_stats["encoded_frames"] += 1
            if peer_stats["encoded_frames"] % 10 == 0:
                emit_peer_message({"type": "stats", **peer_stats})

        encoded.connect("handoff", encoded_handoff)

        sender.connect("on-ice-candidate", lambda _element, mline, candidate: emit_peer_message({
            "type": "ice-candidate", "sdpMLineIndex": mline, "candidate": candidate
        }))
        sender.connect("notify::connection-state", lambda element, _property: emit_peer_message({
            "type": "connection-state", "state": element.get_property("connection-state").value_nick
        }))

        def attach_data_channel(channel):
            def on_message(_channel, payload):
                try:
                    emit_peer_message({"type": "input", "packet": json.loads(payload)})
                except (ValueError, TypeError):
                    pass
            channel.connect("on-message-string", on_message)

        def on_data_channel(_element, channel):
            attach_data_channel(channel)

        sender.connect("on-data-channel", on_data_channel)
        pipeline.set_state(Gst.State.READY)
        native_channel = sender.emit("create-data-channel", "parsage-native-input", None)
        if native_channel:
            attach_data_channel(native_channel)

        def offer_created(promise, *_args):
            reply = promise.get_reply()
            offer = reply.get_value("offer")
            sender.emit("set-local-description", offer, Gst.Promise.new())
            emit_peer_message({"type": "offer", "sdp": offer.sdp.as_text()})

        def negotiation_needed(_element):
            promise = Gst.Promise.new_with_change_func(offer_created, None, None)
            sender.emit("create-offer", None, promise)

        sender.connect("on-negotiation-needed", negotiation_needed)

        def apply_message(message):
            try:
                if message.get("type") == "answer" and isinstance(message.get("sdp"), str):
                    answer = parse_session_description("answer", message["sdp"])
                    sender.emit("set-remote-description", answer, Gst.Promise.new())
                elif message.get("type") == "ice-candidate" and isinstance(message.get("candidate"), str):
                    sender.emit("add-ice-candidate", int(message.get("sdpMLineIndex", 0)), message["candidate"])
                elif message.get("type") == "stop":
                    loop.quit()
            except Exception as error:
                emit_peer_message({"type": "error", "message": str(error)})
            return False

        def read_commands():
            for line in sys.stdin:
                try:
                    message = json.loads(line)
                    GLib.idle_add(apply_message, message)
                except (ValueError, TypeError) as error:
                    emit_peer_message({"type": "error", "message": f"Invalid control message: {error}"})
            GLib.idle_add(loop.quit)

        threading.Thread(target=read_commands, daemon=True).start()
        bus = pipeline.get_bus()
        bus.add_signal_watch()

        def bus_message(_bus, message):
            if message.type == Gst.MessageType.ERROR:
                error, debug = message.parse_error()
                emit_peer_message({"type": "error", "message": f"{error.message} ({debug or 'no details'})"})
                loop.quit()

        bus.connect("message", bus_message)
        pipeline.set_state(Gst.State.PLAYING)
        emit_peer_message({"type": "ready", "encoder": encoder})
        loop.run()
        return 0
    finally:
        if pipeline:
            pipeline.set_state(Gst.State.NULL)
        if session:
            session.close()


def run_benchmark(args):
    require_native_runtime()
    caps = capabilities()
    encoder = args.encoder if args.encoder != "auto" else caps["recommended_encoder"]
    if not encoder or not caps["encoders"].get(encoder):
        raise RuntimeError(f"Encoder is unavailable: {encoder or 'none'}")

    session = ScreenCastSession()
    pipeline = None
    try:
        fd, target_property, target = session.open()
        description = build_pipeline(fd, target_property, target, encoder, args.bitrate * 1000, args.fps)
        pipeline = Gst.parse_launch(description)
        sink = pipeline.get_by_name("encoded")
        stats = {"frames": 0, "bytes": 0}

        def on_handoff(_sink, buffer, _pad):
            stats["frames"] += 1
            stats["bytes"] += buffer.get_size()

        sink.connect("handoff", on_handoff)
        bus = pipeline.get_bus()
        pipeline.set_state(Gst.State.PLAYING)
        started = time.monotonic()
        deadline = started + args.seconds
        error = None
        while time.monotonic() < deadline:
            message = bus.timed_pop_filtered(
                100 * Gst.MSECOND,
                Gst.MessageType.ERROR | Gst.MessageType.EOS,
            )
            if message and message.type == Gst.MessageType.ERROR:
                err, debug = message.parse_error()
                error = f"{err.message} ({debug or 'no debug details'})"
                break
            if message and message.type == Gst.MessageType.EOS:
                break
        elapsed = max(time.monotonic() - started, 0.001)
        result = {
            "encoder": encoder,
            "target": target,
            "seconds": round(elapsed, 3),
            "encoded_frames": stats["frames"],
            "encoded_fps": round(stats["frames"] / elapsed, 2),
            "output_mbps": round(stats["bytes"] * 8 / elapsed / 1_000_000, 2),
            "error": error,
        }
        print(json.dumps(result, indent=2))
        return 1 if error or stats["frames"] == 0 else 0
    finally:
        if pipeline:
            pipeline.set_state(Gst.State.NULL)
        session.close()


def run_webrtc_loopback(args):
    require_native_runtime()
    caps = capabilities()
    encoder = (
        "h264_software" if args.test_source else
        args.encoder if args.encoder != "auto" else caps["recommended_encoder"]
    )
    if not encoder or not caps["encoders"].get(encoder):
        raise RuntimeError(f"Encoder is unavailable: {encoder or 'none'}")
    session = None if args.test_source else ScreenCastSession()
    pipeline = None
    try:
        if session:
            fd, target_property, target = session.open()
            description = build_webrtc_loopback_pipeline(
                fd, target_property, target, encoder, args.bitrate * 1000, args.fps
            )
        else:
            description = add_webrtc_loopback(
                "videotestsrc is-live=true pattern=ball "
                f"! video/x-raw,width=1280,height=720,framerate={args.fps}/1 "
                "! videoconvert ! video/x-raw,format=NV12 "
                f"! x264enc bitrate={args.bitrate * 1000} speed-preset=ultrafast tune=zerolatency "
                f"key-int-max={args.fps} bframes=0 ! video/x-h264,profile=main ! h264parse "
            )
        pipeline = Gst.parse_launch(description)
        sender = pipeline.get_by_name("sender")
        receiver = pipeline.get_by_name("receiver")
        receive_queue = pipeline.get_by_name("receive_queue")
        sink = pipeline.get_by_name("received")
        stats = {"frames": 0, "bytes": 0, "error": None, "receiver_pad": None}

        receive_caps = Gst.Caps.from_string(
            "application/x-rtp,media=video,encoding-name=H264,payload=96,clock-rate=90000"
        )
        receiver.emit(
            "add-transceiver",
            GstWebRTC.WebRTCRTPTransceiverDirection.RECVONLY,
            receive_caps,
        )

        def on_receiver_pad(_element, pad):
            sink_pad = receive_queue.get_static_pad("sink")
            if not sink_pad.is_linked():
                stats["receiver_pad"] = pad.link(sink_pad).value_nick

        receiver.connect("pad-added", on_receiver_pad)

        sink.connect("handoff", lambda _sink, buffer, _pad: (
            stats.__setitem__("frames", stats["frames"] + 1),
            stats.__setitem__("bytes", stats["bytes"] + buffer.get_size()),
        ))

        sender.connect("on-ice-candidate", lambda _element, mline, candidate: (
            receiver.emit("add-ice-candidate", mline, candidate)
        ))
        receiver.connect("on-ice-candidate", lambda _element, mline, candidate: (
            sender.emit("add-ice-candidate", mline, candidate)
        ))

        def on_answer_created(promise, *_args):
            reply = promise.get_reply()
            answer = reply.get_value("answer")
            receiver.emit("set-local-description", answer, Gst.Promise.new())
            sender.emit("set-remote-description", answer, Gst.Promise.new())

        def on_offer_set(_promise, *_args):
            promise = Gst.Promise.new_with_change_func(on_answer_created, None, None)
            receiver.emit("create-answer", None, promise)

        def on_offer_created(promise, *_args):
            reply = promise.get_reply()
            offer = reply.get_value("offer")
            sender.emit("set-local-description", offer, Gst.Promise.new())
            remote_promise = Gst.Promise.new_with_change_func(on_offer_set, None, None)
            receiver.emit("set-remote-description", offer, remote_promise)

        def on_negotiation_needed(_element):
            promise = Gst.Promise.new_with_change_func(on_offer_created, None, None)
            sender.emit("create-offer", None, promise)

        sender.connect("on-negotiation-needed", on_negotiation_needed)
        pipeline.set_state(Gst.State.PLAYING)
        bus = pipeline.get_bus()
        started = time.monotonic()
        deadline = started + args.seconds
        while time.monotonic() < deadline:
            context = GLib.MainContext.default()
            while context.pending():
                context.iteration(False)
            if stats["receiver_pad"] is None:
                sink_pad = receive_queue.get_static_pad("sink")
                for receive_pad in receiver.srcpads:
                    if not sink_pad.is_linked():
                        stats["receiver_pad"] = receive_pad.link(sink_pad).value_nick
            message = bus.timed_pop_filtered(
                100 * Gst.MSECOND,
                Gst.MessageType.ERROR | Gst.MessageType.EOS,
            )
            if message and message.type == Gst.MessageType.ERROR:
                err, debug = message.parse_error()
                stats["error"] = f"{err.message} ({debug or 'no debug details'})"
                break
            if message and message.type == Gst.MessageType.EOS:
                break
        elapsed = max(time.monotonic() - started, 0.001)

        result = {
            "encoder": encoder,
            "seconds": round(elapsed, 3),
            "received_rtp_packets": stats["frames"],
            "received_rtp_packets_per_second": round(stats["frames"] / elapsed, 2),
            "sender_state": sender.get_property("connection-state").value_nick,
            "receiver_state": receiver.get_property("connection-state").value_nick,
            "receiver_pad_link": stats["receiver_pad"],
            "receiver_pads": [pad.get_name() for pad in receiver.pads],
            "error": stats["error"],
        }
        print(json.dumps(result, indent=2))
        return 1 if stats["error"] or stats["frames"] == 0 else 0
    finally:
        if pipeline:
            pipeline.set_state(Gst.State.NULL)
        if session:
            session.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("probe", help="Report native media capabilities")
    benchmark = subparsers.add_parser("benchmark", help="Capture and encode a selected screen")
    benchmark.add_argument("--encoder", choices=("auto", "h264_vaapi", "h264_software"), default="auto")
    benchmark.add_argument("--bitrate", type=int, default=25, help="Target bitrate in Mbps")
    benchmark.add_argument("--fps", type=int, default=60)
    benchmark.add_argument("--seconds", type=int, default=10)
    loopback = subparsers.add_parser("webrtc-loopback", help="Capture, encode, WebRTC-send, and decode locally")
    loopback.add_argument("--encoder", choices=("auto", "h264_vaapi", "h264_software"), default="auto")
    loopback.add_argument("--bitrate", type=int, default=25, help="Target bitrate in Mbps")
    loopback.add_argument("--fps", type=int, default=60)
    loopback.add_argument("--seconds", type=int, default=10)
    loopback.add_argument("--test-source", action="store_true", help=argparse.SUPPRESS)
    peer = subparsers.add_parser("webrtc-peer", help="Run a signaling-controlled native WebRTC sender")
    peer.add_argument("--encoder", choices=("auto", "h264_vaapi", "h264_software"), default="auto")
    peer.add_argument("--bitrate", type=int, default=25, help="Target bitrate in Mbps")
    peer.add_argument("--fps", type=int, default=60)
    peer.add_argument("--test-source", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    if args.command == "probe":
        print(json.dumps(capabilities(), indent=2))
        return 0
    if args.command == "benchmark":
        return run_benchmark(args)
    if args.command == "webrtc-peer":
        return run_webrtc_peer(args)
    return run_webrtc_loopback(args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except NATIVE_ERRORS as error:
        print(f"native pipeline error: {error}", file=sys.stderr)
        raise SystemExit(1)
