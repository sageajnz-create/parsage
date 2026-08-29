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
- Experimental Electron bridge that exchanges native SDP/ICE through an authenticated Parsage room
- Native SCTP data-channel reception with the same host-side input permission checks

## Verified hardware result

On the development AMD Radeon host, the VA-API path encoded 300 frames in 5.007 seconds (59.91 FPS) with no pipeline error. Output averaged 19.97 Mbps under a 25 Mbps configured ceiling.

Run:

```bash
parsage native-status
parsage native-benchmark --seconds 10 --fps 60 --bitrate 25
```

## Next integration boundary

The verified `webrtcbin` transport now exchanges SDP/ICE through Electron and the existing signaling membership. The browser capture path remains the default until native sessions pass connection, recovery, and latency acceptance tests.

The deterministic WebRTC transport test currently reaches `connected` on both peers and receives H.264 RTP. The remaining boundary is end-to-end validation of the portal-backed source against a remote Chromium viewer, followed by a shared capture pipeline that can feed multiple native WebRTC peers.

## Experimental live path

The installed Electron app now exposes **Native VA-API** after one viewer has been approved. It launches a portal-authorized native sender, forwards its offer and ICE candidates over the existing signaling membership, and routes the viewer's answer and candidates back to GStreamer. Browser capture remains the supported fallback.

This first integration slice is deliberately limited to one approved viewer. Its GStreamer control protocol, H.264 offer, ICE trickling, and SCTP media section are verified locally; a complete portal-to-remote-browser session must still pass the WAN acceptance run before the live native checkbox in the parity roadmap is closed. Multi-viewer native hosting will require one `webrtcbin` peer per viewer fed from a shared capture/encoder pipeline.
