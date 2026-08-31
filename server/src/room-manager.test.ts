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

test('does not let a joining peer claim the host role', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host', socket());
  rooms.registerClient('guest', socket());
  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: false });

  rooms.joinRoom('guest', roomCode, 'Guest', 'host');
  assert.equal(rooms.getClient('guest')?.role, 'client');
  assert.equal(rooms.getRoom(roomCode)?.hostId, 'host');
});

test('keeps each client in exactly one room', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host-a', socket());
  rooms.registerClient('host-b', socket());
  rooms.registerClient('guest', socket());
  const { roomCode: roomA } = rooms.createRoom('host-a', 'Host A', { requireApproval: false });
  const { roomCode: roomB } = rooms.createRoom('host-b', 'Host B', { requireApproval: false });

  assert.equal(rooms.joinRoom('guest', roomA, 'Guest').success, true);
  assert.equal(rooms.joinRoom('guest', roomB, 'Guest').success, false);
  assert.throws(() => rooms.createRoom('guest', 'Guest Host'), /already belongs/);
  assert.equal(rooms.getClient('guest')?.roomCode, roomA);
  assert.equal(rooms.getRoom(roomA)?.peers.filter(peer => peer.id === 'guest').length, 1);
  assert.equal(rooms.getRoom(roomB)?.peers.length, 0);
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

test('prevents hosts from administering peers in another room', () => {
  const rooms = new RoomManager();
  const foreignSocket = new FakeSocket();
  rooms.registerClient('host-a', socket());
  rooms.registerClient('host-b', socket());
  rooms.registerClient('foreign-peer', foreignSocket as unknown as WebSocket);
  rooms.createRoom('host-a', 'Host A', { requireApproval: false });
  const { roomCode: roomB } = rooms.createRoom('host-b', 'Host B', { requireApproval: true });
  rooms.joinRoom('foreign-peer', roomB, 'Foreign Peer');

  const permissions = { gamepad: false, mouse: true, keyboard: true, audio: false };
  assert.equal(rooms.approvePeer('host-a', 'foreign-peer', 0), false);
  assert.equal(rooms.updatePermissions('host-a', 'foreign-peer', permissions), false);
  assert.equal(rooms.kickPeer('host-a', 'foreign-peer'), false);
  assert.equal(rooms.getClient('foreign-peer')?.approved, false);
  assert.equal(rooms.getClient('foreign-peer')?.permissions.gamepad, true);
  assert.equal(foreignSocket.closed, false);
});

test('releases a slot and removes the room when its host leaves', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host', socket());
  rooms.registerClient('guest', socket());
  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: false });
  rooms.joinRoom('guest', roomCode, 'Guest');
  rooms.updatePermissions('host', 'guest', {
    gamepad: true, mouse: true, keyboard: true, audio: true
  });

  assert.equal(rooms.releaseSlot('guest', 0), true);
  assert.equal(rooms.getRoom(roomCode)?.slots[0], null);
  const removed = rooms.removeClient('host');
  assert.equal(removed.wasHost, true);
  assert.equal(rooms.getRoom(roomCode), undefined);
  assert.equal(rooms.getClient('guest')?.roomCode, null);
  assert.equal(rooms.getClient('guest')?.role, 'client');
  assert.equal(rooms.getClient('guest')?.slot, null);
  assert.equal(rooms.getClient('guest')?.permissions.mouse, false);
});

test('remembers approval for the same verified identity across reconnects', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host', socket(), 'Host', 'google-host');
  rooms.registerClient('guest-old', socket(), 'Guest', 'google-guest');
  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: true });

  rooms.joinRoom('guest-old', roomCode, 'Guest');
  assert.equal(rooms.getClient('guest-old')?.approved, false);
  assert.equal(rooms.approvePeer('host', 'guest-old', 0), true);
  rooms.removeClient('guest-old');

  rooms.registerClient('guest-new', socket(), 'Guest', 'google-guest');
  const rejoined = rooms.joinRoom('guest-new', roomCode, 'Guest');
  assert.equal(rejoined.success, true);
  assert.equal(rooms.getClient('guest-new')?.approved, true);
  assert.equal(rooms.getClient('guest-new')?.slot, 0);
});

test('does not transfer approval to an anonymous or different identity', () => {
  const rooms = new RoomManager();
  rooms.registerClient('host', socket(), 'Host', 'google-host');
  rooms.registerClient('approved', socket(), 'Guest', 'google-approved');
  const { roomCode } = rooms.createRoom('host', 'Host', { requireApproval: true });
  rooms.joinRoom('approved', roomCode, 'Guest');
  rooms.approvePeer('host', 'approved');
  rooms.removeClient('approved');

  rooms.registerClient('anonymous', socket());
  rooms.joinRoom('anonymous', roomCode, 'Guest');
  rooms.registerClient('different', socket(), 'Other', 'google-other');
  rooms.joinRoom('different', roomCode, 'Other');

  assert.equal(rooms.getClient('anonymous')?.approved, false);
  assert.equal(rooms.getClient('different')?.approved, false);
});

test('reconnects only the same authenticated identity to an existing peer', () => {
  const rooms = new RoomManager();
  const oldSocket = socket();
  const newSocket = socket();
  rooms.registerClient('guest', oldSocket, 'Guest', 'google-guest');

  assert.equal(rooms.reconnectClient('guest', newSocket, 'google-other'), null);
  assert.equal(rooms.getClient('guest')?.ws, oldSocket);
  assert.equal(rooms.reconnectClient('guest', newSocket, 'google-guest')?.id, 'guest');
  assert.equal(rooms.getClient('guest')?.ws, newSocket);
});
