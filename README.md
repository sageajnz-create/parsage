# 🌿 PARSAGE
### *Plug-and-Play Low-Latency Game & Desktop Streaming for Linux (Wayland/Omarchy) & Friends*

> **Created with ❤️ by Sage & Antigravity**  
> *"One love, low latency, no limits."*

---

## 🎮 What is Parsage?

**Parsage** is a modern, open-source alternative to Parsec engineered specifically to solve the Linux hosting problem. On Linux (especially Wayland / Hyprland / Omarchy), standard tools often fail to host co-op sessions or require painful port-forwarding and manual pairing.

Parsage gives you:
- **Instant Room Codes & WebRTC P2P NAT Traversal** (zero router port-forwarding needed).
- **Native Wayland & Omarchy Host Support** (zero-copy PipeWire screen and audio monitor capture).
- **Hardware Acceleration**: AMD VA-API (Navi 23 / Radeon RX 6650 XT) and NVIDIA NVENC support for sub-4ms video compression.
- **4 Virtual Xbox 360 Controllers (`/dev/uinput`)**: Linux games and emulators (Steam, Proton, RetroArch, Dolphin, Smash, Overcooked) see your remote buddies as physical local controllers.
- **Zero-Install Client for Buddies**: Friends on Windows, macOS, or Linux can join straight from their web browser (Chrome, Edge, Firefox) or desktop app, plug in their controllers, and start playing.
- **Reggae Theme (Stones & Cheese)** matching Omarchy's system theme.

---

## 🎨 Reggae Theme Palette

```
Role            Hex Code  Description
─────────────────────────────────────────────────────────────
Background Deep #1B1A17   Deep slate canvas & window
Card Surface    #272520   Card backgrounds & panels
Text Warm       #F3E5AB   Warm sand / cream foreground
Reggae Green    #1EB53A   Connected, Low Latency, Player 1
Reggae Gold     #FFC72C   Host active, primary actions, Player 2
Reggae Red      #E8112D   Disconnect, high jitter, Player 3
Zion Teal       #4FBFA8   Latency graphs, visualizer, Player 4
```

---

## 🚀 Quick Start

### 1. Launch Host & Hub
```bash
# Using the Parsage CLI
./bin/parsage host

# Or with npm
npm run dev:server
```

### 2. Open Web Control Center
Visit **`http://localhost:7777`** in your browser.
1. Click **Start Hosting Session** to get your room code (e.g. `PARSAGE-R4STA-777`).
2. Select your game or full monitor.
3. Send the room link to your buddies.
4. Plug in controllers and enjoy seamless co-op gaming!

---

## 🕹️ CLI Commands

- `./bin/parsage host` — Starts the host engine, signaling broker, and 4 virtual Xbox 360 gamepads.
- `./bin/parsage join <CODE>` — Joins an active room session.
- `./bin/parsage status` — Checks system capabilities, GPU encoder, PipeWire, and uinput state.
- `./bin/parsage uinput-setup` — Configures udev rules for non-root `/dev/uinput` gamepad access.

---

## 🛠️ Architecture

```
parsage/
├── bin/
│   └── parsage                     # Unified CLI launcher
├── server/
│   ├── src/
│   │   ├── index.ts                # WebSocket & HTTP server
│   │   ├── room-manager.ts         # Room codes & slot management
│   │   ├── stun-turn.ts            # Public STUN/TURN configuration
│   │   └── types.ts                # Shared message protocols
├── host/
│   ├── parsage_host.py             # Linux host daemon & bridge
│   ├── uinput_service.py           # 4-Slot Virtual Xbox 360 controller injector
│   └── pipewire_capture.py         # Hardware & PipeWire diagnostics
├── web/
│   ├── src/
│   │   ├── components/             # Reggae UI, HostView, ClientView, GamepadTester, StatsOverlay
│   │   ├── hooks/                  # useWebRTC, useGamepad, useStats
│   │   └── styles/theme.css        # Stones & Cheese Reggae design system
└── packaging/                      # udev rules & desktop launcher
```

---

## 📜 Credits & License
Built with passion by **Sage & Antigravity**.  
Licensed under the MIT License.
