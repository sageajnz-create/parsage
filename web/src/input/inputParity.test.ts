import assert from 'node:assert/strict';
import test from 'node:test';
import { LINUX_KEYMAP, keyboardPacket, linuxKeycode } from './linuxKeymap.ts';
import { packetAllowed, releasePacket, revokedKinds } from './permissions.ts';
import { ControllerBindings, padIdentity } from './controllerSlots.ts';
import {
  coalescedMovement,
  highRateMouseSamples,
  relativeMouseMovePacket
} from './relativeMouse.ts';
import { stuckReleasePackets } from './release.ts';
import { applyRumbleToMatchingPad, rumbleMatchesPad } from './rumble.ts';

test('browser WASD maps onto Linux KEY_* rather than keyCode leftovers', () => {
  assert.equal(linuxKeycode('KeyW'), 17);
  assert.equal(linuxKeycode('KeyA'), 30);
  assert.equal(linuxKeycode('KeyS'), 31);
  assert.equal(linuxKeycode('KeyD'), 32);
  assert.equal(linuxKeycode('Space'), 57);
  assert.equal(linuxKeycode('ShiftLeft'), 42);
  assert.equal(linuxKeycode('ArrowUp'), 103);
  assert.equal(LINUX_KEYMAP.Escape, 1);
  assert.equal(keyboardPacket({ code: 'KeyW', type: 'keydown' })?.keycode, 17);
  assert.equal(keyboardPacket({ code: 'KeyW', type: 'keydown', repeat: true }), null);
});

test('keyboard and relative mouse stay behind the existing permission checks', () => {
  const denied = { approved: true, permissions: { gamepad: true, mouse: false, keyboard: false, audio: true } };
  const allowed = { approved: true, permissions: { gamepad: true, mouse: true, keyboard: true, audio: true } };
  const unapproved = { approved: false, permissions: allowed.permissions };
  assert.equal(packetAllowed({ type: 'keyboard' }, denied), false);
  assert.equal(packetAllowed({ type: 'mouse' }, denied), false);
  assert.equal(packetAllowed({ type: 'gamepad' }, denied), true);
  assert.equal(packetAllowed({ type: 'keyboard' }, allowed), true);
  assert.equal(packetAllowed({ type: 'mouse' }, allowed), true);
  assert.equal(packetAllowed({ type: 'keyboard' }, unapproved), false);
  assert.deepEqual(revokedKinds(allowed.permissions, denied.permissions), ['mouse', 'keyboard']);
  assert.deepEqual(releasePacket('peer-1', ['keyboard']), { type: 'release', peerId: 'peer-1', kinds: ['keyboard'] });
});

test('disconnect and permission revoke emit releases instead of leaving injected input', () => {
  const packets = stuckReleasePackets({
    slot: 2,
    padId: 'xbox#0',
    keys: [17, 30],
    mouseButtons: [0],
    kinds: ['gamepad', 'mouse', 'keyboard']
  });
  assert.deepEqual(packets.filter((packet) => packet.type === 'keyboard').map((packet) => packet.keycode), [17, 30]);
  assert.equal(packets.some((packet) => packet.type === 'mouse' && packet.action === 'up' && packet.button === 0), true);
  const pad = packets.find((packet) => packet.type === 'gamepad');
  assert.equal(pad?.slot, 2);
  assert.equal(pad?.buttons, 0);
  assert.deepEqual(pad?.axes, [0, 0, 0, 0, 0, 0]);
});

test('controller identities keep their slots across browser reorder and hotplug', () => {
  const bindings = new ControllerBindings();
  assert.equal(bindings.bind('pad-a', 0), 0);
  assert.equal(bindings.bind('pad-b', 1), 1);
  assert.equal(bindings.bind('pad-c', 2), 2);
  assert.equal(bindings.bind('pad-d', 3), 3);
  assert.deepEqual(bindings.reindex(['pad-d', 'pad-c', 'pad-b', 'pad-a']), [3, 2, 1, 0]);
  assert.equal(bindings.unbind('pad-b'), 1);
  assert.equal(bindings.bind('hotplug-e', 1), 1);
  assert.equal(bindings.slotFor('pad-a'), 0);
  assert.equal(bindings.slotFor('pad-c'), 2);
  assert.equal(padIdentity({ id: 'Xbox Controller', index: 2 }), 'Xbox Controller#2');
});

test('high-polling-rate relative mouse keeps every coalesced sample', () => {
  const samples = highRateMouseSamples(1000, 1, -1);
  const packet = relativeMouseMovePacket(samples);
  assert.equal(packet?.samples?.length, 1000);
  assert.equal(packet?.dx, 1000);
  assert.equal(packet?.dy, -1000);
  const coalesced = coalescedMovement({
    movementX: 3,
    movementY: 0,
    getCoalescedEvents: () => [{ movementX: 1, movementY: 0 }, { movementX: 2, movementY: 0 }]
  });
  assert.deepEqual(coalesced, [{ dx: 1, dy: 0 }, { dx: 2, dy: 0 }]);
});

test('rumble returns to the matching physical controller, not the first pad', () => {
  const pads = [
    { id: 'pad-a', index: 0 },
    { id: 'pad-b', index: 1 },
    { id: 'pad-c', index: 2 }
  ];
  assert.equal(rumbleMatchesPad({ strong: 1, weak: 1, duration: 40, padId: 'pad-c', slot: 2 }, pads[2], 2), true);
  assert.equal(rumbleMatchesPad({ strong: 1, weak: 1, duration: 40, padId: 'pad-c', slot: 2 }, pads[0], 0), false);
  const played: string[] = [];
  const fakePads = pads.map((pad) => ({
    ...pad,
    vibrationActuator: {
      playEffect: (_name: string, _effect: unknown) => {
        played.push(pad.id);
        return Promise.resolve();
      }
    }
  })) as unknown as Gamepad[];
  assert.equal(applyRumbleToMatchingPad(fakePads, { strong: 1, weak: 0.4, duration: 80, padId: 'pad-b', slot: 1 }, 1), true);
  assert.deepEqual(played, ['pad-b']);
});
