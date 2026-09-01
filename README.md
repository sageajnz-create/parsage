# 🌿 Parsage

[![Release](https://img.shields.io/github/v/release/sageajnz-create/parsage?color=3DDC5B&label=release)](https://github.com/sageajnz-create/parsage/releases)
[![Platform](https://img.shields.io/badge/platform-Linux%20(Wayland%20%7C%20X11)-FFD966)](#)
[![Distros](https://img.shields.io/badge/distros-Mint%20%7C%20Ubuntu%20%7C%20Arch%20%7C%20Debian%20%7C%20Fedora-4FBFA8)](#)
[![License](https://img.shields.io/badge/license-MIT-informational)](#)

> High-performance, plug-and-play game and desktop streaming for Linux.  
> *"Ultra-low latency, zero config, no limits."*  
> **Created with ❤️ by Sage & Antigravity**

---

## ⚡ What is Parsage?

**Parsage** is a lightweight, low-latency game and desktop streaming suite designed specifically for Linux (Wayland / Hyprland / X11) and cross-platform clients. It brings native Parsec-style host and client capabilities to Linux with zero router configuration.

🌐 **Official Website & Downloads**: [https://sageajnz-create.github.io/parsage/](https://sageajnz-create.github.io/parsage/)

---

## 🌟 Key Features

- **⚡ Low-latency WebRTC streaming**: Chromium-managed screen capture and encoding with configurable resolution, frame rate, and bitrate targets. H.264 is negotiated first; HEVC/AV1 are added only when both peers advertise them.
- **🎮 4-Player Virtual Xbox 360 Controllers**: Linux kernel `/dev/uinput` ioctl driver exposing 4 genuine Xbox 360 joysticks with dual-motor force feedback rumble.
- **🌐 P2P with relay support**: WebRTC ICE/STUN hole-punching with configurable TURN fallback for restrictive networks.
- **📡 Local LAN Direct Connect (<1ms)**: Auto-discovers local network IPs to bypass public internet when on the same Wi-Fi or Ethernet.
- **🖥️ Standalone Native Desktop App**: Both host and client live in one single application window with no browser overhead.
- **🕹️ Couch Co-op Arcade**: Browse public party rooms or host multiplayer sessions for games like Smash, Overcooked, and Steam co-op.
- **👥 Friends & Presence**: Live status indicators, gamer tag invites, and 1-click room joining.
- **⚙️ Streaming controls**: Resolution, frame-rate, bitrate, controller calibration, and per-peer host permissions. Packet loss lowers bitrate and requests a new keyframe.

---

## 📦 Installation

### Option A: Linux Mint / Ubuntu / Debian (`.deb` Package)
Download the latest `.deb` package from [Releases](https://github.com/sageajnz-create/parsage/releases/latest) and double-click to install (or run):
```bash
sudo dpkg -i parsage_0.2.0_all.deb
```

### Option B: Universal 1-Command Terminal Installer
Install on any Linux distribution (Mint, Ubuntu, Arch, Fedora, Debian, Pop!_OS):
```bash
curl -fsSL https://raw.githubusercontent.com/sageajnz-create/parsage/master/packaging/install.sh | bash
```

---

## 🚀 Usage

Launch Parsage from your Application Menu / Start Menu, or type:
```bash
parsage
```

### CLI Commands:
- `parsage` — Launch the standalone desktop application
- `parsage host` — Start hosting your desktop and launch the app
- `parsage join <CODE>` — Join a live session with its generated room code
- `parsage status` — Run system diagnostics for VA-API, PipeWire, and uinput
- `parsage native-status` — Inspect native PipeWire, WebRTC, and encoder support
- `parsage native-benchmark` — Select a screen and measure native H.264 encoding
- `parsage native-webrtc-test` — Verify capture, encode, ICE/DTLS/SRTP, and RTP reception locally
- `parsage support-bundle` — Write a local diagnostics JSON file (no secrets)
- `parsage check-update` — Compare this install to the latest GitHub release

---

## 🛠️ Project Structure

```
parsage/
├── app/          # Native Electron Desktop Application Wrapper
├── host/         # Linux /dev/uinput kernel driver & PipeWire diagnostics
├── server/       # WebRTC signaling, room hub, and LAN IP discovery
├── web/          # React + Vite desktop client & in-stream overlay
├── website/      # Public download & marketing website (GitHub Pages)
├── packaging/    # .deb package builder & universal installer
└── bin/          # Unified CLI binary runner
```

### Development setup

Use Node.js 22 or newer and Python 3.10 or newer. Install the locked JavaScript dependencies and run the portable test suite with:

```bash
cd server && npm ci
cd ../web && npm ci
cd .. && npm test
```

The server tests and web build run on Linux, macOS, and Windows. Host tests can exercise pipeline construction without GStreamer; live PipeWire capture and native WebRTC commands require the Linux packages declared by the Debian package in `packaging/build_deb.py`.

See [Development plan](docs/DEVELOPMENT_PLAN.md) for the prioritized delivery sequence and [client matrix](docs/CLIENT_MATRIX.md) for what CI actually covers.

---

## 📜 License & Credits

Google login requires a real OAuth Web client ID. See [Google authentication](docs/AUTHENTICATION.md) for secure setup.

---

- Created with ❤️ by **Sage & Antigravity**
- Open source under the [MIT License](LICENSE)
