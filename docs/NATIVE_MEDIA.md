# Native media backend

The native backend is being introduced behind the existing Chromium WebRTC path. It currently proves the capture and encode half of the pipeline without changing the working application transport.

## Implemented

- XDG ScreenCast portal session and explicit user consent
- Restricted PipeWire remote opened from the portal-provided file descriptor
- PipeWire stream targeting using `pipewire.serial` when provided
- Low-buffer-depth capture pipeline
- AMD/Intel VA H.264 encoding with software H.264 fallback
- HEVC/AV1 encoding only when the viewer advertises that codec; H.264 stays first
- Sender pacing (small leaky queue) plus loss-driven bitrate changes and forced keyframes
- Capture and encode stage timing on the native sender; decode/network/present from the viewer HUD
- Measured encoded frame throughput and output bitrate
- Local `webrtcbin` negotiation through ICE, DTLS, SRTP, and H.264 RTP reception
- Experimental Electron bridge that exchanges native SDP/ICE through an authenticated Parsage room
- Native SCTP data-channel reception with the same host-side input permission checks
- Host-side rumble packets can be returned on that data channel to the slot owner

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

This first integration slice is deliberately limited to one approved viewer. Its GStreamer control protocol, negotiated codec offer (H.264 first), ICE trickling, and SCTP media section are verified locally; a complete portal-to-remote-browser session must still pass the WAN acceptance run before the live native checkbox in the parity roadmap is closed. Multi-viewer native hosting will require one `webrtcbin` peer per viewer fed from a shared capture/encoder pipeline.

Loss reports from the viewer (`media-feedback` on the data channel, or `{ "type": "adapt", "lossRatio": 0.08 }` on the native stdin control socket) lower the encoder bitrate. A hard loss spike or `{ "type": "request-keyframe" }` sends a `GstForceKeyUnit` event so the viewer can recover without waiting for the next periodic IDR.

The automated browser gate launches the signaling server, joins an isolated headless Chromium viewer, performs the browser-to-native handoff, and requires GStreamer's connection state to reach `connected`:

```bash
npm run test:native-browser
```

This gate caught and now covers two live-integration defects: renegotiating SCTP on the existing browser peer, and a missing `GstSdp` runtime import. It currently uses a deterministic test source; the portal-selected display remains the manual acceptance step.

The portal-backed variant is now automated as far as the required user consent allows:

```bash
npm run test:native-portal
```

On the development Radeon host it negotiated `h264_vaapi` and Chromium decoded the selected 1920×1080 PipeWire display at ready state 4. Portal mode requires real decoded frames and dimensions; the deterministic moving-pattern gate additionally requires the decoded-frame counter to advance. This distinction is intentional because a damage-driven portal source may stop emitting buffers while the selected desktop is static.
