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

- [x] Negotiate H.264 first, then add HEVC/AV1 only when both peers advertise support.
- [x] Add sender pacing, loss-driven bitrate adaptation, and explicit keyframe recovery.
- [x] Measure capture, encode, network, decode, and present latency separately.
- Add GPU-specific 1080p60 quality gates and retain the browser capture fallback.

Gate: a remote 1080p60 session stays below 25 Mbps without sustained frame loss, and telemetry identifies the dominant latency stage. The WAN soak and TURN-only NAT run still belong to Sage's network; automated unit tests cover codec choice, bitrate steps, and keyframe policy.

## 4. Harden input parity

Status: implemented in the current working tree.

- [x] Implement keyboard mapping and relative mouse mode behind the existing permission checks.
- [x] Return rumble events to the correct physical controller.
- [x] Release stuck state on disconnect, hotplug, and controller reorder.
- [x] Add four-controller soak and high-polling-rate mouse tests.

Gate: disconnect and permission tests cannot leave injected input active, and the four-controller soak completes without slot drift. Both run in CI without controllers or `/dev/uinput`.

Implementation note: Linux `KeyboardEvent.code` mapping, relative/coalesced mouse packets, identity-stable slot binding, and rumble routing live in `host/input_parity.py` and `web/src/input/`. The host still applies the existing per-peer approval/permission bits before injection. Force-feedback readback from the virtual pads needs a live game that writes `FF_RUMBLE`; CI proves routing and cleanup rather than a physical motor.

## 5. Productize releases

Status: implemented without a live distro farm.

- [x] Persist identity, devices, friendships, and presence in a durable store.
- [x] Add expiring/revocable quick links, structured logs, and support bundles.
- [x] Test install, upgrade, service lifecycle, and uninstall for the existing `.deb` and `install.sh` paths in CI (prefix extract; not a multi-distro dpkg farm).
- [x] Add crash recovery, update delivery, accessibility checks, and a maintained client matrix sourced from real gates.

Remaining outside this phase: live Mint/Arch/Fedora package farms and TURN soak.

Gate: release CI produces tested artifacts and a clean install/update/uninstall report for the packaged `.deb` / `install.sh` path. Live distro-farm reports are still out of scope.
