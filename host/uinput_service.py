#!/usr/bin/env python3
"""
🌿 PARSAGE Linux Virtual Input Subsystem (/dev/uinput)
Manages 4 Virtual Xbox 360 Gamepads (P1-P4) & Virtual Mouse/Keyboard
Created with ❤️ by Sage & Antigravity
"""

import os
import sys
import time
import fcntl
import struct
import socket
import json
import signal
import threading

# Linux Input Event Constants
EV_SYN = 0x00
EV_KEY = 0x01
EV_REL = 0x02
EV_ABS = 0x03

SYN_REPORT = 0

# Gamepad Button Codes (Linux standard)
BTN_SOUTH = 0x130  # A
BTN_EAST  = 0x131  # B
BTN_NORTH = 0x133  # X (West in standard notation)
BTN_WEST  = 0x134  # Y (North in standard notation)
BTN_TL    = 0x136  # LB (Left Bumper)
BTN_TR    = 0x137  # RB (Right Bumper)
BTN_SELECT = 0x13a # Back / View / Select
BTN_START  = 0x13b # Start / Menu
BTN_MODE   = 0x13c # Guide / Xbox Home
BTN_THUMBL = 0x13d # L3 (Left Stick Click)
BTN_THUMBR = 0x13e # R3 (Right Stick Click)
BTN_DPAD_UP    = 0x220
BTN_DPAD_DOWN  = 0x221
BTN_DPAD_LEFT  = 0x222
BTN_DPAD_RIGHT = 0x223

# Mouse Button Codes
BTN_LEFT   = 0x110
BTN_RIGHT  = 0x111
BTN_MIDDLE = 0x112

# Relative Axes (Mouse)
REL_X     = 0x00
REL_Y     = 0x01
REL_WHEEL = 0x08

# Absolute Axes (Gamepad)
ABS_X     = 0x00 # Left Stick X
ABS_Y     = 0x01 # Left Stick Y
ABS_Z     = 0x02 # Left Trigger (0 - 255)
ABS_RX    = 0x03 # Right Stick X
ABS_RY    = 0x04 # Right Stick Y
ABS_RZ    = 0x05 # Right Trigger (0 - 255)
ABS_HAT0X = 0x10 # D-pad X (-1, 0, 1)
ABS_HAT0Y = 0x11 # D-pad Y (-1, 0, 1)

# UInput IOCTLs
UI_SET_EVBIT  = 0x40045564
UI_SET_KEYBIT = 0x40045565
UI_SET_RELBIT = 0x40045566
UI_SET_ABSBIT = 0x40045567
UI_DEV_CREATE = 0x5501
UI_DEV_DESTROY = 0x5502

# Standard W3C Gamepad Button Mapping to Linux Keycodes
BUTTON_MAP = [
    BTN_SOUTH,      # 0: A
    BTN_EAST,       # 1: B
    BTN_NORTH,      # 2: X
    BTN_WEST,       # 3: Y
    BTN_TL,         # 4: LB
    BTN_TR,         # 5: RB
    None,           # 6: LT (Analog axis ABS_Z)
    None,           # 7: RT (Analog axis ABS_RZ)
    BTN_SELECT,     # 8: Back / Select
    BTN_START,      # 9: Start
    BTN_THUMBL,     # 10: L3
    BTN_THUMBR,     # 11: R3
    BTN_DPAD_UP,    # 12: D-pad Up
    BTN_DPAD_DOWN,  # 13: D-pad Down
    BTN_DPAD_LEFT,  # 14: D-pad Left
    BTN_DPAD_RIGHT, # 15: D-pad Right
    BTN_MODE        # 16: Guide / Home
]

class VirtualGamepad:
    def __init__(self, slot_index: int):
        self.slot_index = slot_index
        self.fd = None
        self.name = f"Parsage Virtual Xbox Controller {slot_index + 1}"
        self.create_device()

    def create_device(self):
        try:
            self.fd = os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK)
        except Exception as e:
            print(f"[UInput] Error opening /dev/uinput: {e}", file=sys.stderr)
            self.fd = None
            return False

        # Set event bits
        fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_KEY)
        fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_ABS)
        fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_SYN)

        # Register buttons
        buttons = [
            BTN_SOUTH, BTN_EAST, BTN_NORTH, BTN_WEST,
            BTN_TL, BTN_TR, BTN_SELECT, BTN_START,
            BTN_MODE, BTN_THUMBL, BTN_THUMBR,
            BTN_DPAD_UP, BTN_DPAD_DOWN, BTN_DPAD_LEFT, BTN_DPAD_RIGHT
        ]
        for btn in buttons:
            fcntl.ioctl(self.fd, UI_SET_KEYBIT, btn)

        # Register axes
        axes = [ABS_X, ABS_Y, ABS_Z, ABS_RX, ABS_RY, ABS_RZ, ABS_HAT0X, ABS_HAT0Y]
        for axis in axes:
            fcntl.ioctl(self.fd, UI_SET_ABSBIT, axis)

        # Construct uinput_user_dev struct
        name_bytes = self.name.encode('utf-8').ljust(80, b'\x00')
        # Bus USB (3), Microsoft Vendor (0x045e), Xbox 360 Controller (0x028e), Version (0x0114)
        input_id = struct.pack('HHHH', 0x03, 0x045e, 0x028e, 0x0114)
        ff_effects_max = struct.pack('i', 0)

        absmax = [0] * 64
        absmin = [0] * 64
        absfuzz = [0] * 64
        absflat = [0] * 64

        # Thumbsticks: -32768 to 32767
        for a in [ABS_X, ABS_Y, ABS_RX, ABS_RY]:
            absmin[a] = -32768
            absmax[a] = 32767
            absflat[a] = 128
            absfuzz[a] = 16

        # Triggers: 0 to 255
        for a in [ABS_Z, ABS_RZ]:
            absmin[a] = 0
            absmax[a] = 255

        # D-pad Hat: -1 to 1
        for a in [ABS_HAT0X, ABS_HAT0Y]:
            absmin[a] = -1
            absmax[a] = 1

        user_dev = (
            name_bytes +
            input_id +
            ff_effects_max +
            struct.pack('64i', *absmax) +
            struct.pack('64i', *absmin) +
            struct.pack('64i', *absfuzz) +
            struct.pack('64i', *absflat)
        )

        os.write(self.fd, user_dev)
        fcntl.ioctl(self.fd, UI_DEV_CREATE)
        print(f"[UInput] Registered {self.name} on slot P{self.slot_index + 1}")
        return True

    def emit(self, event_type: int, code: int, value: int):
        if self.fd is None:
            return
        # struct input_event { struct timeval time; __u16 type; __u16 code; __s32 value; }
        # On 64-bit Linux timeval is two 64-bit longs: 'qqHHi' (24 bytes)
        event = struct.pack('qqHHi', 0, 0, event_type, code, value)
        os.write(self.fd, event)

    def sync(self):
        self.emit(EV_SYN, SYN_REPORT, 0)

    def process_state(self, buttons: int, axes: list):
        """
        buttons: 16-bit mask
        axes: [LX, LY, RX, RY, LT, RT] in float (-1.0 to 1.0, triggers 0.0 to 1.0)
        """
        if self.fd is None:
            return

        # Process Buttons
        for i, btn_code in enumerate(BUTTON_MAP):
            if btn_code is None:
                continue
            is_pressed = 1 if (buttons & (1 << i)) != 0 else 0
            self.emit(EV_KEY, btn_code, is_pressed)

        # Process Axes (Thumbsticks)
        if len(axes) >= 4:
            lx = int(max(-1.0, min(1.0, axes[0])) * 32767)
            ly = int(max(-1.0, min(1.0, axes[1])) * 32767)
            rx = int(max(-1.0, min(1.0, axes[2])) * 32767)
            ry = int(max(-1.0, min(1.0, axes[3])) * 32767)

            self.emit(EV_ABS, ABS_X, lx)
            self.emit(EV_ABS, ABS_Y, ly)
            self.emit(EV_ABS, ABS_RX, rx)
            self.emit(EV_ABS, ABS_RY, ry)

        # Process Triggers (LT / RT)
        if len(axes) >= 6:
            lt = int(max(0.0, min(1.0, axes[4])) * 255)
            rt = int(max(0.0, min(1.0, axes[5])) * 255)
            self.emit(EV_ABS, ABS_Z, lt)
            self.emit(EV_ABS, ABS_RZ, rt)

        # Process D-Pad Hat coordinates
        dpad_x = 0
        dpad_y = 0
        if buttons & (1 << 14): # D-pad Left
            dpad_x -= 1
        if buttons & (1 << 15): # D-pad Right
            dpad_x += 1
        if buttons & (1 << 12): # D-pad Up
            dpad_y -= 1
        if buttons & (1 << 13): # D-pad Down
            dpad_y += 1

        self.emit(EV_ABS, ABS_HAT0X, dpad_x)
        self.emit(EV_ABS, ABS_HAT0Y, dpad_y)

        self.sync()

    def destroy(self):
        if self.fd is not None:
            try:
                fcntl.ioctl(self.fd, UI_DEV_DESTROY)
                os.close(self.fd)
                print(f"[UInput] Destroyed {self.name}")
            except Exception:
                pass
            self.fd = None


class VirtualMouseKeyboard:
    def __init__(self):
        self.fd = None
        self.name = "Parsage Virtual Mouse & Keyboard"
        self.create_device()

    def create_device(self):
        try:
            self.fd = os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK)
        except Exception as e:
            print(f"[UInput] Error opening /dev/uinput for mouse/keyboard: {e}", file=sys.stderr)
            return False

        # Set event bits
        fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_KEY)
        fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_REL)
        fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_SYN)

        # Mouse relative axes
        for axis in [REL_X, REL_Y, REL_WHEEL]:
            fcntl.ioctl(self.fd, UI_SET_RELBIT, axis)

        # Mouse buttons
        for btn in [BTN_LEFT, BTN_RIGHT, BTN_MIDDLE]:
            fcntl.ioctl(self.fd, UI_SET_KEYBIT, btn)

        # Standard keyboard keys (1 to 248)
        for key in range(1, 248):
            try:
                fcntl.ioctl(self.fd, UI_SET_KEYBIT, key)
            except Exception:
                pass

        name_bytes = self.name.encode('utf-8').ljust(80, b'\x00')
        input_id = struct.pack('HHHH', 0x03, 0x1234, 0x5678, 0x01)
        ff_effects_max = struct.pack('i', 0)
        absmax = [0] * 64
        absmin = [0] * 64
        absfuzz = [0] * 64
        absflat = [0] * 64

        user_dev = (
            name_bytes +
            input_id +
            ff_effects_max +
            struct.pack('64i', *absmax) +
            struct.pack('64i', *absmin) +
            struct.pack('64i', *absfuzz) +
            struct.pack('64i', *absflat)
        )

        os.write(self.fd, user_dev)
        fcntl.ioctl(self.fd, UI_DEV_CREATE)
        print(f"[UInput] Registered {self.name}")
        return True

    def emit(self, event_type: int, code: int, value: int):
        if self.fd is None:
            return
        event = struct.pack('qqHHi', 0, 0, event_type, code, value)
        os.write(self.fd, event)

    def sync(self):
        self.emit(EV_SYN, SYN_REPORT, 0)

    def mouse_move(self, dx: int, dy: int):
        if self.fd is None:
            return
        self.emit(EV_REL, REL_X, dx)
        self.emit(EV_REL, REL_Y, dy)
        self.sync()

    def mouse_button(self, button_idx: int, pressed: bool):
        if self.fd is None:
            return
        mapping = {0: BTN_LEFT, 1: BTN_MIDDLE, 2: BTN_RIGHT}
        btn = mapping.get(button_idx, BTN_LEFT)
        self.emit(EV_KEY, btn, 1 if pressed else 0)
        self.sync()

    def mouse_wheel(self, delta: int):
        if self.fd is None:
            return
        self.emit(EV_REL, REL_WHEEL, delta)
        self.sync()

    def key_event(self, keycode: int, pressed: bool):
        if self.fd is None:
            return
        self.emit(EV_KEY, keycode, 1 if pressed else 0)
        self.sync()

    def destroy(self):
        if self.fd is not None:
            try:
                fcntl.ioctl(self.fd, UI_DEV_DESTROY)
                os.close(self.fd)
                print(f"[UInput] Destroyed {self.name}")
            except Exception:
                pass
            self.fd = None


class InputManager:
    def __init__(self, num_slots: int = 4):
        self.gamepads = [VirtualGamepad(i) for i in range(num_slots)]
        self.mouse_kbd = VirtualMouseKeyboard()
        self.running = True

    def process_gamepad_packet(self, slot: int, buttons: int, axes: list):
        if 0 <= slot < len(self.gamepads):
            self.gamepads[slot].process_state(buttons, axes)

    def process_mouse_packet(self, data: dict):
        action = data.get('type')
        if action == 'move':
            dx = int(data.get('dx', 0))
            dy = int(data.get('dy', 0))
            self.mouse_kbd.mouse_move(dx, dy)
        elif action == 'down':
            btn = data.get('button', 0)
            self.mouse_kbd.mouse_button(btn, True)
        elif action == 'up':
            btn = data.get('button', 0)
            self.mouse_kbd.mouse_button(btn, False)
        elif action == 'wheel':
            delta = int(data.get('deltaY', 0))
            self.mouse_kbd.mouse_wheel(-1 if delta > 0 else 1)

    def process_keyboard_packet(self, data: dict):
        action = data.get('type')
        keycode = data.get('keycode', 0)
        if keycode > 0:
            self.mouse_kbd.key_event(keycode, action == 'down')

    def shutdown(self):
        self.running = False
        for gp in self.gamepads:
            gp.destroy()
        self.mouse_kbd.destroy()


def run_ipc_server(manager: InputManager, host='127.0.0.1', port=7778):
    """
    TCP IPC Server that receives JSON/Binary input packets from WebRTC host
    """
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((host, port))
    server.listen(5)
    print(f"[UInput IPC] Listening for input packets on {host}:{port}")

    def handle_client(conn, addr):
        buffer = ""
        while manager.running:
            try:
                data = conn.recv(4096)
                if not data:
                    break
                buffer += data.decode('utf-8', errors='ignore')
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    if not line.strip():
                        continue
                    try:
                        pkt = json.loads(line)
                        pkt_type = pkt.get('type')
                        if pkt_type == 'gamepad':
                            slot = pkt.get('slot', 0)
                            buttons = pkt.get('buttons', 0)
                            axes = pkt.get('axes', [0, 0, 0, 0, 0, 0])
                            manager.process_gamepad_packet(slot, buttons, axes)
                        elif pkt_type == 'mouse':
                            manager.process_mouse_packet(pkt)
                        elif pkt_type == 'keyboard':
                            manager.process_keyboard_packet(pkt)
                    except Exception as e:
                        pass
            except Exception:
                break
        conn.close()

    try:
        while manager.running:
            conn, addr = server.accept()
            t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
            t.start()
    except Exception:
        pass
    finally:
        server.close()


if __name__ == '__main__':
    print("""
============================================================
  🌿 PARSAGE LINUX VIRTUAL INPUT SUBSYSTEM
  Created with ❤️ by Sage & Antigravity
============================================================
    """)
    manager = InputManager(num_slots=4)

    def sig_handler(sig, frame):
        print("\n[Parsage] Terminating input devices...")
        manager.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    run_ipc_server(manager)
