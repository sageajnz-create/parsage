import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { RoomManager } from './room-manager.js';

class FakeSocket {
  readyState: number = WebSocket.OPEN;
  messages: unknown[] = [];
  closed = false;

  send(raw: string) {
    this.messages.push(JSON.parse(raw));
  }

  close() {
    this.closed = true;
    this.readyState = WebSocket.CLOSED;
  }
}

const socket = () => new FakeSocket() as unknown as WebSocket;

test('creates a room and assigns the first guest to slot one', () => {
  const rooms = new RoomManager();
  const hostSocket = socket();
  const guestSocket = socket();
  rooms.registerClient('host', hostSocket);
  rooms.registerClient('guest', guestSocket);

  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: false });
  assert.match(roomCode, /^PARSAGE-[A-Z0-9]+-[A-Z2-9]{8}$/);
  const result = rooms.joinRoom('guest', roomCode.toLowerCase(), 'Guest');

  assert.equal(result.success, true);
  assert.equal(result.state?.slots[0], 'guest');
  assert.equal(rooms.getClient('guest')?.slot, 0);
});

test('expires unattended approval requests', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host', socket());
  const guestSocket = new FakeSocket();
  rooms.registerClient('guest', guestSocket as unknown as WebSocket);
  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: true });
  rooms.joinRoom('guest', roomCode, 'Guest');
  const joinedAt = rooms.getClient('guest')!.joinedAt;

  assert.deepEqual(rooms.expirePending(joinedAt + 60_000, 60_000), ['guest']);
  assert.equal(rooms.getClient('guest'), undefined);
  assert.equal(guestSocket.closed, true);
});

test('expires stale rooms and disconnects their participants', () => {
  const rooms = new RoomManager();
  const hostSocket = new FakeSocket();
  rooms.registerClient('host', hostSocket as unknown as WebSocket);
  const { roomCode, state } = rooms.createRoom('host', 'Host');

  assert.deepEqual(rooms.expireRooms(state.createdAt + 1000, 1000), [roomCode]);
  assert.equal(rooms.getRoom(roomCode), undefined);
  assert.equal(hostSocket.closed, true);
});

test('requires host approval before assigning a protected slot', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host', socket());
  rooms.registerClient('guest', socket());
  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: true });

  rooms.joinRoom('guest', roomCode, 'Guest');
  assert.equal(rooms.getClient('guest')?.approved, false);
  assert.equal(rooms.getClient('guest')?.slot, null);
  assert.equal(rooms.claimSlot('guest', 0), false);
  assert.equal(rooms.canExchangeRtc('guest', 'host'), false);

  assert.equal(rooms.approvePeer('host', 'guest', 2), true);
  assert.equal(rooms.getClient('guest')?.slot, 2);
  assert.equal(rooms.canExchangeRtc('guest', 'host'), true);
  assert.equal(rooms.canExchangeRtc('host', 'guest'), true);
});

test('blocks RTC messages between unrelated rooms', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host-a', socket());
  rooms.registerClient('host-b', socket());
  rooms.createRoom('host-a', 'Host A');
  rooms.createRoom('host-b', 'Host B');
  assert.equal(rooms.canExchangeRtc('host-a', 'host-b'), false);
});

test('prevents guests from changing permissions or kicking peers', () => {
  const rooms = new RoomManager();
  const targetSocket = new FakeSocket();
  rooms.registerClient('host', socket());
  rooms.registerClient('guest', socket());
  rooms.registerClient('target', targetSocket as unknown as WebSocket);
  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: false });
  rooms.joinRoom('guest', roomCode, 'Guest');
  rooms.joinRoom('target', roomCode, 'Target');

  assert.equal(rooms.updatePermissions('guest', 'target', {
    gamepad: false, mouse: true, keyboard: true, audio: false
  }), false);
  assert.equal(rooms.kickPeer('guest', 'target'), false);
  assert.equal(targetSocket.closed, false);
});

test('releases a slot and removes the room when its host leaves', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host', socket());
  rooms.registerClient('guest', socket());
  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: false });
  rooms.joinRoom('guest', roomCode, 'Guest');

  assert.equal(rooms.releaseSlot('guest', 0), true);
  assert.equal(rooms.getRoom(roomCode)?.slots[0], null);
  const removed = rooms.removeClient('host');
  assert.equal(removed.wasHost, true);
  assert.equal(rooms.getRoom(roomCode), undefined);
});
