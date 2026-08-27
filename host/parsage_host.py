#!/usr/bin/env python3
"""
🌿 PARSAGE Host Daemon & Input Bridge
Connects to signaling server, manages P1-P4 uinput gamepads, and handles local input injection.
Created with ❤️ by Sage & Antigravity
"""

import os
import sys
import time
import signal
import socket
import threading
import subprocess
from uinput_service import InputManager, run_ipc_server
from pipewire_capture import get_system_diagnostics

def start_uinput_ipc(manager, port=7778):
    t = threading.Thread(target=run_ipc_server, args=(manager, '127.0.0.1', port), daemon=True)
    t.start()
    return t

def main():
    print("""
======================================================================
  🌿 PARSAGE LINUX HOST ENGINE
  "Ultra-low latency, zero config, no limits."
  Created with ❤️ by Sage & Antigravity
======================================================================
    """)
    diag = get_system_diagnostics()
    print(f"  [System] Environment: {diag['display_server'].upper()} / {diag['desktop_env']}")
    print(f"  [GPU]    Encoder:     {diag['recommended_encoder'].upper()} on {diag['gpu_vendor']}")
    print(f"  [Input]  Subsystem:   Linux uinput (4 Gamepad Slots + Mouse/Keys)")
    print("======================================================================\n")

    input_manager = InputManager(num_slots=4)
    start_uinput_ipc(input_manager, port=7778)

    print("  ✅ Virtual Gamepads (Slots 1-4) & Mouse/Keyboard initialized.")
    print("  ⚡ Listening for WebRTC DataChannel inputs on 127.0.0.1:7778\n")
    print("  To connect with your buddies:")
    print("  1. Launch the web interface at http://localhost:7777 (or npm run dev:web)")
    print("  2. Click 'Start Hosting Session' to get your secure room code")
    print("  3. Share the code with your friends to join instantly!\n")

    def handle_exit(sig, frame):
        print("\n[Parsage] Shutting down host engine...")
        input_manager.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        handle_exit(None, None)

if __name__ == '__main__':
    main()
