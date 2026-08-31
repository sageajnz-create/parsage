# Parsage development plan

This plan turns the product-level parity roadmap into an implementation order. A phase is complete only when its automated checks and stated acceptance gate pass.

## 1. Restore a dependable development baseline

Status: implemented in the current working tree.

- Keep dependency installation deterministic with the `server` and `web` lockfiles.
- Let pure host unit tests run when the Linux GStreamer runtime is absent.
- Make `npm test` locate Python consistently on Linux, macOS, and Windows.
- Keep real native-media commands fail-fast with an actionable dependency message.

Gate: a clean install passes server tests, the production web build, and host unit tests; native capability probing remains usable on a non-Linux contributor machine.

## 2. Close P0 with production evidence

- [x] Add a live local signaling gate for approval, RTC authorization, reconnect state, and reconnect-token replay.
- [x] Reject cross-room host administration, cross-room RTC forwarding, hostile browser origins, and client-supplied host roles.
- [x] Automate an authenticated host/viewer session covering login cookies, identity-bound names, approval, unauthorized signaling, and reconnect ownership.
- [x] Enforce single-room membership and clear guest roles, slots, and permissions when a host ends a room.
- [x] Force a browser signaling disconnect and verify peer resumption, reconnect-token rotation, retained RTC authorization, and an `iceRestart` offer.
- Run a TURN-only restrictive-NAT test in a controlled environment.
- Record a 30-minute WAN soak result with disconnect, memory, and error counts.

Gate: every P0 acceptance case in `PARITY_ROADMAP.md` has a repeatable command and an archived result.

## 3. Make native media adaptive and observable

- Negotiate H.264 first, then add HEVC/AV1 only when both peers advertise support.
- Add sender pacing, loss-driven bitrate adaptation, and explicit keyframe recovery.
- Measure capture, encode, network, decode, and present latency separately.
- Add GPU-specific 1080p60 quality gates and retain the browser capture fallback.

Gate: a remote 1080p60 session stays below 25 Mbps without sustained frame loss, and telemetry identifies the dominant latency stage.

## 4. Harden input parity

- Implement keyboard mapping and relative mouse mode behind the existing permission checks.
- Return rumble events to the correct physical controller.
- Release stuck state on disconnect, hotplug, and controller reorder.
- Add four-controller soak and high-polling-rate mouse tests.

Gate: disconnect and permission tests cannot leave injected input active, and the four-controller soak completes without slot drift.

## 5. Productize releases

- Persist identity, devices, friendships, and presence in a durable store.
- Add expiring/revocable quick links, structured logs, and support bundles.
- Test install, upgrade, service lifecycle, and uninstall on each supported distribution.
- Add crash recovery, update delivery, accessibility checks, and a maintained client matrix.

Gate: release CI produces tested artifacts and a clean install/update/uninstall report for every supported target.
