import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';

type Message = Record<string, any> & { type: string };
type Waiter = {
  predicate: (message: Message) => boolean;
  resolve: (message: Message) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

class SignalingClient {
  readonly messages: Message[] = [];
  private readonly waiters: Waiter[] = [];

  constructor(readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as Message;
      const waiterIndex = this.waiters.findIndex(waiter => waiter.predicate(message));
      if (waiterIndex >= 0) {
        const [waiter] = this.waiters.splice(waiterIndex, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      } else {
        this.messages.push(message);
      }
    });
  }

  send(message: Message): void {
    this.ws.send(JSON.stringify(message));
  }

  waitFor(type: string, predicate: (message: Message) => boolean = () => true): Promise<Message> {
    const queuedIndex = this.messages.findIndex(message => message.type === type && predicate(message));
    if (queuedIndex >= 0) return Promise.resolve(this.messages.splice(queuedIndex, 1)[0]);

    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        predicate: message => message.type === type && predicate(message),
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for signaling message: ${type}`));
        }, 3000),
      };
      this.waiters.push(waiter);
    });
  }

  close(): void {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }
}

async function availablePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(port: number, process: ChildProcess): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`Signaling server exited with code ${process.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) return;
    } catch {
      // The child may still be binding its listener.
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for signaling server');
}

async function connect(port: number): Promise<{ client: SignalingClient; token: string }> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const client = new SignalingClient(ws);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const ready = await client.waitFor('session-ready');
  assert.equal(typeof ready.token, 'string');
  return { client, token: ready.token };
}

async function rejectsCrossOriginSocket(port: number): Promise<void> {
  await assert.rejects(new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'https://malicious.example' });
    ws.once('open', () => {
      ws.close();
      resolve();
    });
    ws.once('error', reject);
  }), /Unexpected server response: 401/);
}

test('approval gates RTC, cross-room administration, and reconnect resumption', async (t) => {
  const port = await availablePort();
  const serverPath = fileURLToPath(new URL('./index.js', import.meta.url));
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      REQUIRE_AUTH: 'false',
      PARSAGE_STORE_PATH: join(tmpdir(), `parsage-store-${port}.json`),
      PARSAGE_CRASH_PATH: join(tmpdir(), `parsage-crash-${port}.json`),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverErrors = '';
  child.stderr?.on('data', chunk => { serverErrors += chunk.toString(); });
  const clients: SignalingClient[] = [];

  t.after(async () => {
    for (const client of clients) client.close();
    if (child.exitCode === null) child.kill('SIGTERM');
    await new Promise<void>(resolve => {
      if (child.exitCode !== null) resolve();
      else child.once('exit', () => resolve());
    });
  });

  await waitForServer(port, child).catch(error => {
    throw new Error(`${error.message}${serverErrors ? `: ${serverErrors}` : ''}`);
  });
  await rejectsCrossOriginSocket(port);

  const host = await connect(port);
  const guest = await connect(port);
  const outsider = await connect(port);
  clients.push(host.client, guest.client, outsider.client);

  host.client.send({ type: 'create-room', name: 'Host', settings: { requireApproval: true } });
  const created = await host.client.waitFor('room-created');
  const hostId = created.hostId as string;
  const roomCode = created.roomCode as string;

  guest.client.send({ type: 'join-room', roomCode, name: 'Guest', role: 'host' });
  const joined = await guest.client.waitFor('room-joined');
  const guestId = joined.peerId as string;
  assert.equal(joined.state.peers.find((peer: any) => peer.id === guestId)?.role, 'client');
  assert.equal(joined.state.peers.find((peer: any) => peer.id === guestId)?.approved, false);

  guest.client.send({ type: 'offer', targetPeerId: hostId, sdp: { type: 'offer', sdp: 'blocked' } });
  const preApprovalError = await guest.client.waitFor('error');
  assert.match(preApprovalError.message, /not authorized/);

  outsider.client.send({ type: 'create-room', name: 'Other Host', settings: { requireApproval: false } });
  const outsiderRoom = await outsider.client.waitFor('room-created');
  guest.client.send({ type: 'join-room', roomCode: outsiderRoom.roomCode, name: 'Guest Again' });
  assert.match((await guest.client.waitFor('error')).message, /Leave the current room/);
  guest.client.send({ type: 'create-room', name: 'Guest Host' });
  assert.match((await guest.client.waitFor('error')).message, /Leave the current room/);
  outsider.client.send({ type: 'approve-peer', peerId: guestId, slot: 0 });
  outsider.client.send({
    type: 'update-permissions',
    peerId: guestId,
    permissions: { gamepad: false, mouse: true, keyboard: true, audio: false },
  });
  outsider.client.send({ type: 'kick-peer', peerId: guestId });
  outsider.client.send({ type: 'ping', timestamp: 42 });
  await outsider.client.waitFor('pong', message => message.timestamp === 42);

  host.client.send({ type: 'approve-peer', peerId: guestId, slot: 1 });
  const approved = await guest.client.waitFor('peer-approved');
  const approvedGuest = approved.state.peers.find((peer: any) => peer.id === guestId);
  assert.equal(approvedGuest?.approved, true);
  assert.equal(approvedGuest?.slot, 1);
  assert.equal(approvedGuest?.permissions.gamepad, true);

  guest.client.send({ type: 'offer', targetPeerId: hostId, sdp: { type: 'offer', sdp: 'allowed' } });
  const forwarded = await host.client.waitFor('offer', message => message.fromPeerId === guestId);
  assert.equal(forwarded.sdp.sdp, 'allowed');

  guest.client.send({ type: 'media-capabilities', targetPeerId: hostId, codecs: ['h264', 'hevc'] });
  const caps = await host.client.waitFor('media-capabilities', message => message.fromPeerId === guestId);
  assert.deepEqual(caps.codecs, ['h264', 'hevc']);

  outsider.client.send({ type: 'offer', targetPeerId: guestId, sdp: { type: 'offer', sdp: 'cross-room' } });
  const crossRoomError = await outsider.client.waitFor('error');
  assert.match(crossRoomError.message, /not authorized/);

  guest.client.close();
  const resumed = await connect(port);
  clients.push(resumed.client);
  resumed.client.send({ type: 'resume-session', token: guest.token });
  const resumeState = await resumed.client.waitFor('session-resumed');
  assert.equal(resumeState.peerId, guestId);
  assert.equal(resumeState.state.roomCode, roomCode);
  assert.equal(resumeState.state.peers.find((peer: any) => peer.id === guestId)?.approved, true);

  const replay = await connect(port);
  clients.push(replay.client);
  replay.client.send({ type: 'resume-session', token: guest.token });
  await replay.client.waitFor('session-resume-failed');
});
