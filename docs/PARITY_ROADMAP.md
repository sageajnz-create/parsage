# Parsage → Parsec-Class Roadmap

“Parity” means passing measurable behavior and reliability gates, not displaying a setting in the UI.

## Current baseline

- Linux host and Chromium/Electron client
- WebRTC screen/audio transport and signaling
- LAN and STUN connectivity, with configurable TURN fallback
- Four virtual Xbox-style uinput slots
- Per-peer approval and input permissions

## P0 — Safe, reliable remote session

- [x] Approval gates media negotiation and remote input
- [x] Reject cross-room signaling
- [x] TURN configuration through `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL`
- [x] Apply the selected video bitrate to WebRTC senders
- [x] Reconnect signaling and restart ICE after network changes without recreating the room
- [x] Expire unattended approval requests and stale rooms
- [x] Cryptographically strong invitation codes and join-attempt throttling
- [x] Authenticate signaling identities and bind host approvals to the verified identity

Acceptance: 30-minute WAN session, forced Wi-Fi roam, restrictive-NAT relay test, and unauthorized-peer test all pass.

Implementation note: signaling sessions currently have a 15-second reconnect grace period with rotating resume credentials. A verified guest's approval follows their Google subject across a reconnect; it is never inferred from their display name. The full WAN acceptance run above is still required before P0 can be considered validated in production.

## P1 — Gaming-quality media

- [x] Native PipeWire capture backend integrated into live sessions (single-viewer portal path verified in Chromium)
- [x] Explicit VA-API encoding in live sessions (1920×1080 portal frames decoded in Chromium)
- [x] H.264 baseline plus negotiated HEVC/AV1 capability fallback
- [x] Pacing, bitrate adaptation, keyframe recovery, and packet-loss handling
- [ ] Hardware decode path and frame-present timing
- [x] Real telemetry for capture, encode, network, decode, and display latency

Acceptance: 1080p60 under 25 Mbps with no sustained frame drops; latency and quality gates documented per supported GPU.

Integration note: an opt-in, single-viewer Electron path now connects the portal-backed GStreamer sender to authenticated room SDP/ICE and native input-channel handling. The item remains open until a remote Chromium viewer and the recovery/latency acceptance gates pass end to end.

## P2 — Input parity

- [x] Permission-checked gamepad/mouse bridge
- [x] Keyboard capture and Linux key mapping
- [x] Relative mouse mode with tested high-polling-rate behavior
- [x] Rumble return channel
- [x] Hotplug, controller reorder, stuck-key release, and disconnect cleanup
- [ ] Approved-application filtering

Acceptance: four-controller soak test plus keyboard/mouse safety and disconnect tests.

Implementation note: keyboard, relative mouse, rumble routing, and stuck-state release now share host/web rules under `host/input_parity.py` and `web/src/input/`. Permission and disconnect tests plus a hardware-free four-controller soak run in `npm test`. The remaining P2 item is approved-application filtering.

## P3 — Product reliability

- [ ] Persistent identity, authenticated friends, presence, and device ownership
- [ ] Secure quick links with revocation and expiry
- [ ] Auto-update, crash recovery, structured logs, and support bundle
- [ ] Headless-host flow and service lifecycle
- [ ] Cross-platform client matrix and accessibility pass

Acceptance: clean install/update/uninstall plus automated smoke tests on every supported distribution and client platform.
