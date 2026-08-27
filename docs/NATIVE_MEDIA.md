# Native media backend

The native backend is being introduced behind the existing Chromium WebRTC path. It currently proves the capture and encode half of the pipeline without changing the working application transport.

## Implemented

- XDG ScreenCast portal session and explicit user consent
- Restricted PipeWire remote opened from the portal-provided file descriptor
- PipeWire stream targeting using `pipewire.serial` when provided
- Low-buffer-depth capture pipeline
- AMD/Intel VA H.264 encoding with software H.264 fallback
- Measured encoded frame throughput and output bitrate
- Local `webrtcbin` negotiation through ICE, DTLS, SRTP, and H.264 RTP reception

## Verified hardware result

On the development AMD Radeon host, the VA-API path encoded 300 frames in 5.007 seconds (59.91 FPS) with no pipeline error. Output averaged 19.97 Mbps under a 25 Mbps configured ceiling.

Run:

```bash
parsage native-status
parsage native-benchmark --seconds 10 --fps 60 --bitrate 25
```

## Next integration boundary

The verified `webrtcbin` transport must now exchange SDP/ICE through the existing signaling server and use the portal-backed source in that managed lifecycle. The browser capture path remains the default until native sessions pass connection, recovery, and latency acceptance tests.

The deterministic WebRTC transport test currently reaches `connected` on both peers and receives H.264 RTP. The remaining integration work is connecting the portal-backed source to this transport lifecycle and exchanging its SDP/ICE through Electron and the existing room server.
