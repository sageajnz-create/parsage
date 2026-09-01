"""Shared input-parity rules: mapping, permissions, slot identity, and release.

These helpers are deliberately free of /dev/uinput so CI can prove disconnect,
permission, rumble routing, and four-controller soak behavior without hardware.
The Linux host applies the returned operations to the virtual devices.
"""

from __future__ import annotations

NEUTRAL_AXES = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
SLOT_COUNT = 4

# KeyboardEvent.code → Linux KEY_* from linux/input-event-codes.h
LINUX_KEYMAP = {
    "Escape": 1,
    "Digit1": 2, "Digit2": 3, "Digit3": 4, "Digit4": 5, "Digit5": 6,
    "Digit6": 7, "Digit7": 8, "Digit8": 9, "Digit9": 10, "Digit0": 11,
    "Minus": 12, "Equal": 13, "Backspace": 14, "Tab": 15,
    "KeyQ": 16, "KeyW": 17, "KeyE": 18, "KeyR": 19, "KeyT": 20,
    "KeyY": 21, "KeyU": 22, "KeyI": 23, "KeyO": 24, "KeyP": 25,
    "BracketLeft": 26, "BracketRight": 27, "Enter": 28, "ControlLeft": 29,
    "KeyA": 30, "KeyS": 31, "KeyD": 32, "KeyF": 33, "KeyG": 34,
    "KeyH": 35, "KeyJ": 36, "KeyK": 37, "KeyL": 38,
    "Semicolon": 39, "Quote": 40, "Backquote": 41, "ShiftLeft": 42,
    "Backslash": 43,
    "KeyZ": 44, "KeyX": 45, "KeyC": 46, "KeyV": 47, "KeyB": 48,
    "KeyN": 49, "KeyM": 50,
    "Comma": 51, "Period": 52, "Slash": 53, "ShiftRight": 54,
    "NumpadMultiply": 55, "AltLeft": 56, "Space": 57, "CapsLock": 58,
    "F1": 59, "F2": 60, "F3": 61, "F4": 62, "F5": 63,
    "F6": 64, "F7": 65, "F8": 66, "F9": 67, "F10": 68,
    "NumLock": 69, "ScrollLock": 70,
    "Numpad7": 71, "Numpad8": 72, "Numpad9": 73, "NumpadSubtract": 74,
    "Numpad4": 75, "Numpad5": 76, "Numpad6": 77, "NumpadAdd": 78,
    "Numpad1": 79, "Numpad2": 80, "Numpad3": 81, "Numpad0": 82,
    "NumpadDecimal": 83,
    "IntlBackslash": 86, "F11": 87, "F12": 88,
    "NumpadEnter": 96, "ControlRight": 97, "NumpadDivide": 98,
    "PrintScreen": 99, "AltRight": 100,
    "Home": 102, "ArrowUp": 103, "PageUp": 104, "ArrowLeft": 105,
    "ArrowRight": 106, "End": 107, "ArrowDown": 108, "PageDown": 109,
    "Insert": 110, "Delete": 111,
    "AudioVolumeMute": 113, "AudioVolumeDown": 114, "AudioVolumeUp": 115,
    "Pause": 119, "NumpadEqual": 117,
    "MetaLeft": 125, "OSLeft": 125, "MetaRight": 126, "OSRight": 126,
    "ContextMenu": 127,
    "F13": 183, "F14": 184, "F15": 185, "F16": 186, "F17": 187,
    "F18": 188, "F19": 189, "F20": 190, "F21": 191, "F22": 192,
    "F23": 193, "F24": 194,
}

INPUT_KINDS = ("gamepad", "mouse", "keyboard")


def linux_keycode(code, keycode=None):
    """Map a browser KeyboardEvent.code (or already-Linux keycode) to KEY_*."""
    if isinstance(code, str) and code:
        mapped = LINUX_KEYMAP.get(code)
        if mapped:
            return mapped
    if isinstance(keycode, int) and 0 < keycode < 248:
        # Accept a Linux KEY_* that the client already mapped. Reject leftover
        # Windows/browser keyCodes (often > 248 or in the 186–222 punctuation
        # range without a matching KEY_*) by requiring the code string first.
        return keycode
    return None


def packet_kind(packet):
    if not isinstance(packet, dict):
        return None
    kind = packet.get("type")
    if kind in INPUT_KINDS or kind in {"release", "rumble"}:
        return kind
    return None


def packet_allowed(packet, peer):
    """Same host gate used by the browser and native data-channel paths."""
    if not isinstance(packet, dict) or not isinstance(peer, dict):
        return False
    if packet.get("type") == "release":
        return True
    if not peer.get("approved"):
        return False
    permissions = peer.get("permissions") or {}
    kind = packet.get("type")
    if kind == "gamepad":
        return bool(permissions.get("gamepad"))
    if kind == "mouse":
        return bool(permissions.get("mouse"))
    if kind == "keyboard":
        return bool(permissions.get("keyboard"))
    return False


def revoked_kinds(old_permissions, new_permissions):
    old = old_permissions or {}
    new = new_permissions or {}
    return [kind for kind in INPUT_KINDS if old.get(kind) and not new.get(kind)]


def clamp_axis(value, lo=-1.0, hi=1.0):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(lo, min(hi, number))


def normalize_axes(axes):
    values = list(axes or [])
    while len(values) < 6:
        values.append(0.0)
    return [
        clamp_axis(values[0]),
        clamp_axis(values[1]),
        clamp_axis(values[2]),
        clamp_axis(values[3]),
        clamp_axis(values[4], 0.0, 1.0),
        clamp_axis(values[5], 0.0, 1.0),
    ]


def relative_mouse_samples(packet):
    """Expand a relative-mouse packet, including coalesced high-rate samples."""
    if not isinstance(packet, dict):
        return []
    samples = packet.get("samples")
    if isinstance(samples, list) and samples:
        out = []
        for sample in samples:
            if not isinstance(sample, dict):
                continue
            dx = int(sample.get("dx") or 0)
            dy = int(sample.get("dy") or 0)
            if dx or dy:
                out.append((dx, dy))
        return out
    dx = int(packet.get("dx") or 0)
    dy = int(packet.get("dy") or 0)
    if dx or dy:
        return [(dx, dy)]
    return []


def rumble_packet(slot, strong=0.0, weak=0.0, duration_ms=0, pad_id=None, peer_id=None):
    return {
        "type": "rumble",
        "slot": slot,
        "strong": max(0.0, min(1.0, float(strong or 0))),
        "weak": max(0.0, min(1.0, float(weak or 0))),
        "duration": max(0, int(duration_ms or 0)),
        "padId": pad_id,
        "peerId": peer_id,
    }


def rumble_from_ff(effect_type, strong_magnitude, weak_magnitude, length_ms, playing=True):
    """Translate a Linux FF_RUMBLE / EV_FF play-stop into a client packet body."""
    if not playing:
        return {"strong": 0.0, "weak": 0.0, "duration": 0}
    strong = (int(strong_magnitude or 0) & 0xFFFF) / 65535.0
    weak = (int(weak_magnitude or 0) & 0xFFFF) / 65535.0
    if effect_type not in {0x50, "FF_RUMBLE", "rumble", None} and strong == 0 and weak == 0:
        strong = 1.0
        weak = 0.7
    return {
        "strong": strong,
        "weak": weak,
        "duration": max(0, int(length_ms or 0)),
    }


class ControllerSlotMap:
    """Keep physical controller identities on a virtual slot across hotplug."""

    def __init__(self, slot_count=SLOT_COUNT):
        self.slot_count = slot_count
        self.by_identity = {}
        self.by_slot = [None] * slot_count

    def slot_for(self, identity):
        if not identity:
            return None
        return self.by_identity.get(identity)

    def identity_for(self, slot):
        if slot is None or not (0 <= slot < self.slot_count):
            return None
        return self.by_slot[slot]

    def bind(self, identity, preferred_slot=None):
        if not identity:
            return None
        existing = self.by_identity.get(identity)
        if existing is not None:
            if preferred_slot is None or preferred_slot == existing:
                return existing
            self.unbind(identity)
        slot = preferred_slot
        if slot is None or not (0 <= slot < self.slot_count) or self.by_slot[slot] not in {None, identity}:
            slot = next((index for index, occupant in enumerate(self.by_slot) if occupant is None), None)
        if slot is None:
            return None
        occupant = self.by_slot[slot]
        if occupant and occupant != identity:
            return None
        self.by_slot[slot] = identity
        self.by_identity[identity] = slot
        return slot

    def unbind(self, identity):
        slot = self.by_identity.pop(identity, None)
        if slot is not None and self.by_slot[slot] == identity:
            self.by_slot[slot] = None
        return slot

    def unbind_slot(self, slot):
        if slot is None or not (0 <= slot < self.slot_count):
            return None
        identity = self.by_slot[slot]
        if identity:
            self.unbind(identity)
        return identity

    def reindex(self, identities):
        """Browser indices shuffled: identities keep their original slots."""
        return [self.slot_for(identity) for identity in identities]


class InjectedInput:
    """Track injected host state per peer so disconnect cannot leave sticks down."""

    def __init__(self, slot_count=SLOT_COUNT):
        self.slot_count = slot_count
        self.slots = ControllerSlotMap(slot_count)
        self.peers = {}
        self.slot_owners = [None] * slot_count

    def _peer(self, peer_id):
        state = self.peers.get(peer_id)
        if state is None:
            state = {
                "keys": set(),
                "mouse_buttons": set(),
                "slot": None,
                "buttons": 0,
                "axes": list(NEUTRAL_AXES),
                "pad_id": None,
            }
            self.peers[peer_id] = state
        return state

    def has_injected_input(self, peer_id=None):
        if peer_id is not None:
            state = self.peers.get(peer_id)
            if state is None:
                return False
            states = [state]
        else:
            states = self.peers.values()
        for state in states:
            if state["keys"] or state["mouse_buttons"] or state["buttons"]:
                return True
            if any(axis != 0 for axis in state["axes"]):
                return True
        return False

    def apply(self, peer_id, packet, peer=None):
        if packet.get("type") == "release":
            kinds = packet.get("kinds") or INPUT_KINDS
            return self.release_kinds(peer_id, kinds)
        if peer is not None and not packet_allowed(packet, peer):
            return []
        kind = packet.get("type")
        if kind == "keyboard":
            return self._apply_keyboard(peer_id, packet)
        if kind == "mouse":
            return self._apply_mouse(peer_id, packet)
        if kind == "gamepad":
            return self._apply_gamepad(peer_id, packet)
        return []

    def _apply_keyboard(self, peer_id, packet):
        keycode = linux_keycode(packet.get("code") or packet.get("key"), packet.get("keycode"))
        if not keycode:
            return []
        pressed = packet.get("action", "down") != "up"
        keys = self._peer(peer_id)["keys"]
        if pressed:
            keys.add(keycode)
        else:
            keys.discard(keycode)
        return [{"device": "keyboard", "keycode": keycode, "pressed": pressed}]

    def _apply_mouse(self, peer_id, packet):
        ops = []
        action = packet.get("action")
        state = self._peer(peer_id)
        if action == "move" or packet.get("mode") == "relative":
            for dx, dy in relative_mouse_samples(packet):
                ops.append({"device": "mouse", "action": "move", "dx": dx, "dy": dy})
        if action == "down":
            button = int(packet.get("button") or 0)
            state["mouse_buttons"].add(button)
            ops.append({"device": "mouse", "action": "down", "button": button})
        elif action == "up":
            button = int(packet.get("button") or 0)
            state["mouse_buttons"].discard(button)
            ops.append({"device": "mouse", "action": "up", "button": button})
        elif action == "wheel":
            ops.append({"device": "mouse", "action": "wheel", "deltaY": int(packet.get("deltaY") or 0)})
        return ops

    def _apply_gamepad(self, peer_id, packet):
        state = self._peer(peer_id)
        requested = packet.get("slot")
        try:
            requested = int(requested)
        except (TypeError, ValueError):
            requested = state["slot"]
        pad_id = packet.get("id") or packet.get("padId") or state["pad_id"]
        if pad_id and self.slots.slot_for(pad_id) not in {None, requested}:
            previous = self.slots.unbind(pad_id)
            if previous is not None and self.slot_owners[previous] == peer_id:
                self.slot_owners[previous] = None
        slot = self.slots.bind(pad_id, requested) if pad_id else requested
        if slot is None or not (0 <= slot < self.slot_count):
            return []
        if state["slot"] not in {None, slot}:
            vacated = state["slot"]
            if self.slot_owners[vacated] == peer_id:
                self.slot_owners[vacated] = None
                self.slots.unbind_slot(vacated)
        occupant = self.slot_owners[slot]
        if occupant not in {None, peer_id}:
            return []
        self.slot_owners[slot] = peer_id
        state["slot"] = slot
        state["pad_id"] = pad_id
        state["buttons"] = int(packet.get("buttons") or 0)
        state["axes"] = normalize_axes(packet.get("axes"))
        return [{"device": "gamepad", "slot": slot, "buttons": state["buttons"], "axes": list(state["axes"])}]

    def release_kinds(self, peer_id, kinds):
        state = self.peers.get(peer_id)
        if not state:
            return []
        ops = []
        wanted = set(kinds or INPUT_KINDS)
        if "keyboard" in wanted and state["keys"]:
            for keycode in sorted(state["keys"]):
                ops.append({"device": "keyboard", "keycode": keycode, "pressed": False})
            state["keys"].clear()
        if "mouse" in wanted and state["mouse_buttons"]:
            for button in sorted(state["mouse_buttons"]):
                ops.append({"device": "mouse", "action": "up", "button": button})
            state["mouse_buttons"].clear()
        if "gamepad" in wanted and (state["buttons"] or any(axis != 0 for axis in state["axes"]) or state["slot"] is not None):
            slot = state["slot"]
            if slot is not None:
                ops.append({"device": "gamepad", "slot": slot, "buttons": 0, "axes": list(NEUTRAL_AXES)})
                if self.slot_owners[slot] == peer_id:
                    self.slot_owners[slot] = None
                if state["pad_id"]:
                    self.slots.unbind(state["pad_id"])
            state["buttons"] = 0
            state["axes"] = list(NEUTRAL_AXES)
            state["slot"] = None
            state["pad_id"] = None
        if not state["keys"] and not state["mouse_buttons"] and state["slot"] is None:
            self.peers.pop(peer_id, None)
        return ops

    def release_peer(self, peer_id):
        return self.release_kinds(peer_id, INPUT_KINDS)

    def release_revoked(self, peer_id, old_permissions, new_permissions):
        return self.release_kinds(peer_id, revoked_kinds(old_permissions, new_permissions))

    def release_all(self):
        ops = []
        for peer_id in list(self.peers):
            ops.extend(self.release_peer(peer_id))
        return ops

    def rumble_for_slot(self, slot, strong=0.0, weak=0.0, duration_ms=0):
        if slot is None or not (0 <= slot < self.slot_count):
            return None
        peer_id = self.slot_owners[slot]
        pad_id = self.slots.identity_for(slot)
        if peer_id is None and pad_id is None:
            return None
        return rumble_packet(slot, strong, weak, duration_ms, pad_id=pad_id, peer_id=peer_id)


def soak_four_controllers(rounds=400):
    """Exercise four identities through inject, reorder, hotplug, and drop.

    Returns a report. Slot drift or leftover injection is a failure.
    """
    tracker = InjectedInput()
    identities = [f"pad-{index}" for index in range(4)]
    peers = [f"peer-{index}" for index in range(4)]
    approved = {
        "approved": True,
        "permissions": {"gamepad": True, "mouse": False, "keyboard": False},
    }
    for index, identity in enumerate(identities):
        slot = tracker.slots.bind(identity, index)
        if slot != index:
            return {"ok": False, "reason": "initial bind drifted", "slot": slot, "index": index}
        tracker.apply(peers[index], {
            "type": "gamepad",
            "slot": index,
            "id": identity,
            "buttons": 1 << index,
            "axes": [0, 0, 0, 0, 0, 0],
        }, approved)

    for round_index in range(rounds):
        order = identities[round_index % 4:] + identities[: round_index % 4]
        mapped = tracker.slots.reindex(order)
        expected = [identities.index(identity) for identity in order]
        if mapped != expected:
            return {"ok": False, "reason": "reorder drifted", "mapped": mapped, "expected": expected}

        victim = round_index % 4
        tracker.apply(peers[victim], {
            "type": "gamepad",
            "slot": victim,
            "id": identities[victim],
            "buttons": 1 << ((victim + round_index) % 16),
            "axes": [0.2 if round_index % 2 else 0, 0, 0, 0, 0, 0],
        }, approved)

        if round_index % 17 == 0:
            tracker.release_peer(peers[victim])
            if tracker.has_injected_input(peers[victim]):
                return {"ok": False, "reason": "disconnect left injection", "peer": peers[victim]}
            for other in range(4):
                if other == victim:
                    continue
                if tracker.slots.slot_for(identities[other]) != other:
                    return {"ok": False, "reason": "hotplug moved a live slot", "other": other}
            replacement = f"hotplug-{round_index}"
            rebound = tracker.slots.bind(replacement, victim)
            if rebound != victim:
                return {"ok": False, "reason": "hotplug missed free slot", "got": rebound}
            tracker.slots.unbind(replacement)
            tracker.slots.bind(identities[victim], victim)
            tracker.apply(peers[victim], {
                "type": "gamepad",
                "slot": victim,
                "id": identities[victim],
                "buttons": 0,
                "axes": list(NEUTRAL_AXES),
            }, approved)

        if round_index % 29 == 0:
            tracker.release_revoked(peers[victim], approved["permissions"], {
                **approved["permissions"], "gamepad": False
            })
            if tracker.has_injected_input(peers[victim]):
                return {"ok": False, "reason": "permission revoke left injection", "peer": peers[victim]}
            tracker.apply(peers[victim], {
                "type": "gamepad",
                "slot": victim,
                "id": identities[victim],
                "buttons": 1 << victim,
                "axes": list(NEUTRAL_AXES),
            }, {**approved, "permissions": {**approved["permissions"], "gamepad": False}})
            if tracker.has_injected_input(peers[victim]):
                return {"ok": False, "reason": "denied packet still injected"}
            tracker.apply(peers[victim], {
                "type": "gamepad",
                "slot": victim,
                "id": identities[victim],
                "buttons": 1 << victim,
                "axes": list(NEUTRAL_AXES),
            }, approved)

    tracker.release_all()
    if tracker.has_injected_input():
        return {"ok": False, "reason": "soak ended with injected input"}
    if any(tracker.slot_owners):
        return {"ok": False, "reason": "soak ended with owned slots", "owners": list(tracker.slot_owners)}
    return {"ok": True, "rounds": rounds, "slots": 4}
