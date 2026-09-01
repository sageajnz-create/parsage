import unittest

from input_parity import (
    ControllerSlotMap,
    InjectedInput,
    LINUX_KEYMAP,
    linux_keycode,
    packet_allowed,
    relative_mouse_samples,
    rumble_from_ff,
    soak_four_controllers,
)


class KeyboardMappingTests(unittest.TestCase):
    def test_wasd_and_modifiers_use_linux_keycodes(self):
        self.assertEqual(linux_keycode("KeyW"), 17)
        self.assertEqual(linux_keycode("KeyA"), 30)
        self.assertEqual(linux_keycode("KeyS"), 31)
        self.assertEqual(linux_keycode("KeyD"), 32)
        self.assertEqual(linux_keycode("Space"), 57)
        self.assertEqual(linux_keycode("ShiftLeft"), 42)
        self.assertEqual(linux_keycode("Escape"), 1)
        self.assertEqual(LINUX_KEYMAP["ArrowUp"], 103)


class PermissionGateTests(unittest.TestCase):
    def test_keyboard_and_mouse_require_the_existing_permission_bits(self):
        peer = {
            "approved": True,
            "permissions": {"gamepad": True, "mouse": False, "keyboard": False},
        }
        self.assertFalse(packet_allowed({"type": "keyboard", "code": "KeyW"}, peer))
        self.assertFalse(packet_allowed({"type": "mouse", "action": "move", "dx": 1}, peer))
        self.assertTrue(packet_allowed({"type": "gamepad", "slot": 0, "buttons": 1}, peer))
        self.assertFalse(packet_allowed({"type": "keyboard"}, {"approved": False, "permissions": {"keyboard": True}}))


class DisconnectReleaseTests(unittest.TestCase):
    def test_disconnect_and_permission_revoke_clear_injected_state(self):
        tracker = InjectedInput()
        peer = {
            "approved": True,
            "permissions": {"gamepad": True, "mouse": True, "keyboard": True},
        }
        tracker.apply("guest", {"type": "keyboard", "code": "KeyW", "action": "down"}, peer)
        tracker.apply("guest", {"type": "mouse", "action": "down", "button": 0}, peer)
        tracker.apply("guest", {
            "type": "gamepad", "slot": 1, "id": "pad-b", "buttons": 1, "axes": [0.5, 0, 0, 0, 0, 0]
        }, peer)
        self.assertTrue(tracker.has_injected_input("guest"))

        denied = {**peer, "permissions": {**peer["permissions"], "keyboard": False, "mouse": False}}
        tracker.release_revoked("guest", peer["permissions"], denied["permissions"])
        leftover = tracker.apply("guest", {"type": "keyboard", "code": "KeyW", "action": "down"}, denied)
        self.assertEqual(leftover, [])
        self.assertTrue(tracker.has_injected_input("guest"))

        ops = tracker.release_peer("guest")
        devices = {op["device"] for op in ops}
        self.assertIn("gamepad", devices)
        self.assertTrue(any(op["device"] == "gamepad" and op["buttons"] == 0 for op in ops))
        self.assertFalse(tracker.has_injected_input())

    def test_denied_packets_never_stick(self):
        tracker = InjectedInput()
        denied = {"approved": True, "permissions": {"gamepad": False, "mouse": False, "keyboard": False}}
        self.assertEqual(tracker.apply("guest", {"type": "keyboard", "code": "KeyW", "action": "down"}, denied), [])
        self.assertEqual(tracker.apply("guest", {"type": "mouse", "action": "down", "button": 0}, denied), [])
        self.assertEqual(tracker.apply("guest", {"type": "gamepad", "slot": 0, "buttons": 4, "axes": [1, 0, 0, 0, 0, 0]}, denied), [])
        self.assertFalse(tracker.has_injected_input())


class RelativeMouseTests(unittest.TestCase):
    def test_coalesced_high_rate_samples_are_all_applied(self):
        packet = {
            "type": "mouse",
            "action": "move",
            "mode": "relative",
            "samples": [{"dx": 1, "dy": -1}] * 1000,
        }
        samples = relative_mouse_samples(packet)
        self.assertEqual(len(samples), 1000)
        self.assertEqual(sum(dx for dx, _dy in samples), 1000)
        self.assertEqual(sum(dy for _dx, dy in samples), -1000)


class ControllerIdentityTests(unittest.TestCase):
    def test_reorder_keeps_identities_on_the_original_slots(self):
        slots = ControllerSlotMap()
        for index, identity in enumerate(["pad-a", "pad-b", "pad-c", "pad-d"]):
            self.assertEqual(slots.bind(identity, index), index)
        self.assertEqual(slots.reindex(["pad-d", "pad-a", "pad-c", "pad-b"]), [3, 0, 2, 1])
        self.assertEqual(slots.unbind("pad-b"), 1)
        self.assertEqual(slots.bind("hotplug-e"), 1)
        self.assertEqual(slots.slot_for("pad-a"), 0)

    def test_rumble_follows_the_slot_owner_not_browser_index_zero(self):
        tracker = InjectedInput()
        peer = {"approved": True, "permissions": {"gamepad": True, "mouse": False, "keyboard": False}}
        tracker.apply("p2", {"type": "gamepad", "slot": 2, "id": "pad-c", "buttons": 1, "axes": [0, 0, 0, 0, 0, 0]}, peer)
        tracker.apply("p0", {"type": "gamepad", "slot": 0, "id": "pad-a", "buttons": 1, "axes": [0, 0, 0, 0, 0, 0]}, peer)
        packet = tracker.rumble_for_slot(2, 1.0, 0.4, 80)
        self.assertEqual(packet["peerId"], "p2")
        self.assertEqual(packet["padId"], "pad-c")
        self.assertEqual(packet["slot"], 2)
        magnitudes = rumble_from_ff(0x50, 65535, 26214, 80)
        self.assertAlmostEqual(magnitudes["strong"], 1.0, places=3)
        self.assertGreater(magnitudes["weak"], 0.3)


class FourControllerSoakTests(unittest.TestCase):
    def test_four_controller_soak_completes_without_slot_drift(self):
        report = soak_four_controllers(rounds=400)
        self.assertTrue(report["ok"], report)
        self.assertEqual(report["slots"], 4)
