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

- **⚡ Sub-4ms Hardware VA-API & NVENC**: Direct PipeWire capture with AMD Radeon and NVIDIA hardware acceleration supporting 60, 120, 144, and 240 FPS gameplay.
- **🎮 4-Player Virtual Xbox 360 Controllers**: Linux kernel `/dev/uinput` ioctl driver exposing 4 genuine Xbox 360 joysticks with dual-motor force feedback rumble.
- **🌐 Zero Port-Forwarding P2P**: WebRTC STUN hole-punching creates direct UDP channels without router setup.
- **📡 Local LAN Direct Connect (<1ms)**: Auto-discovers local network IPs to bypass public internet when on the same Wi-Fi or Ethernet.
- **🖥️ Standalone Native Desktop App**: Both host and client live in one single application window with no browser overhead.
- **🕹️ Couch Co-op Arcade**: Browse public party rooms or host multiplayer sessions for games like Smash, Overcooked, and Steam co-op.
- **👥 Friends & Presence**: Live status indicators, gamer tag invites, and 1-click room joining.
- **⚙️ Full Settings Matrix**: Video renderer, codec preferences (H.264/HEVC/AV1), stick deadzone calibration, and host permissions.

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
- `parsage join <CODE>` — Join a live session with room code (e.g. `PARSAGE-OMEGA-777`)
- `parsage status` — Run system diagnostics for VA-API, PipeWire, and uinput
- `parsage uinput-setup` — Configure non-root udev rules for virtual controllers

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

---

## 📜 License & Credits

- Created with ❤️ by **Sage & Antigravity**
- Open source under the [MIT License](LICENSE)
