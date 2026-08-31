import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { AuthService } from './auth.js';
import { createParsageServer } from './server.js';

type Message = Record<string, any> & { type: string };

class AuthenticatedClient {
  private readonly queued: Message[] = [];
  private readonly waiters: Array<{
    predicate: (message: Message) => boolean;
    resolve: (message: Message) => void;
    timer: NodeJS.Timeout;
  }> = [];

  constructor(readonly ws: WebSocket) {
    ws.on('message', raw => {
      const message = JSON.parse(raw.toString()) as Message;
      const index = this.waiters.findIndex(waiter => waiter.predicate(message));
      if (index < 0) {
        this.queued.push(message);
        return;
      }
      const [waiter] = this.waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    });
  }

  send(message: Message): void {
    this.ws.send(JSON.stringify(message));
  }

  waitFor(type: string, predicate: (message: Message) => boolean = () => true): Promise<Message> {
    const queuedIndex = this.queued.findIndex(message => message.type === type && predicate(message));
    if (queuedIndex >= 0) return Promise.resolve(this.queued.splice(queuedIndex, 1)[0]);

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate: (message: Message) => message.type === type && predicate(message),
        resolve,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for authenticated signaling message: ${type}`));
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

const clientId = '123-integration.apps.googleusercontent.com';
const identities: Record<string, { sub: string; name: string; email: string }> = {
  'host-credential': { sub: 'google-host', name: 'Verified Host', email: 'host@example.com' },
  'guest-credential': { sub: 'google-guest', name: 'Verified Guest', email: 'guest@example.com' },
  'intruder-credential': { sub: 'google-intruder', name: 'Other Host', email: 'other@example.com' },
};

async function login(origin: string, credential: string): Promise<string> {
  const response = await fetch(`${origin}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ credential }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  return cookie.split(';', 1)[0];
}

async function connect(origin: string, cookie?: string): Promise<{ client: AuthenticatedClient; token: string }> {
  const wsUrl = origin.replace(/^http/, 'ws') + '/ws';
  const ws = new WebSocket(wsUrl, {
    origin,
    headers: cookie ? { Cookie: cookie } : undefined,
  });
  const client = new AuthenticatedClient(ws);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const ready = await client.waitFor('session-ready');
  assert.equal(typeof ready.token, 'string');
  return { client, token: ready.token };
}

test('verified identities govern hosting, approval, and reconnect ownership', async (t) => {
  const auth = new AuthService(clientId, async credential => {
    const identity = identities[credential];
    if (!identity) return undefined;
    return {
      iss: 'https://accounts.google.com',
      aud: clientId,
      sub: identity.sub,
      name: identity.name,
      email: identity.email,
      email_verified: true,
      iat: 1,
      exp: 2,
    };
  });
  const application = createParsageServer({
    auth,
    requireAuth: true,
    host: '127.0.0.1',
    port: 0,
  });
  const clients: AuthenticatedClient[] = [];
  t.after(async () => {
    for (const client of clients) client.close();
    await application.close();
  });

  const port = await application.listen();
  const origin = `http://127.0.0.1:${port}`;

  const rejected = await fetch(`${origin}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://malicious.example' },
    body: JSON.stringify({ credential: 'host-credential' }),
  });
  assert.equal(rejected.status, 403);

  const hostCookie = await login(origin, 'host-credential');
  const guestCookie = await login(origin, 'guest-credential');
  const intruderCookie = await login(origin, 'intruder-credential');

  const anonymous = await connect(origin);
  clients.push(anonymous.client);
  anonymous.client.send({ type: 'create-room', name: 'Anonymous Host' });
  assert.match((await anonymous.client.waitFor('error')).message, /Sign in is required/);

  const host = await connect(origin, hostCookie);
  const guest = await connect(origin, guestCookie);
  const intruder = await connect(origin, intruderCookie);
  clients.push(host.client, guest.client, intruder.client);

  host.client.send({ type: 'create-room', name: 'Impersonated Host', settings: { requireApproval: true } });
  const created = await host.client.waitFor('room-created');
  assert.equal(created.state.hostName, 'Verified Host');

  guest.client.send({ type: 'join-room', roomCode: created.roomCode, name: 'Impersonated Guest' });
  const joined = await guest.client.waitFor('room-joined');
  const guestId = joined.peerId as string;
  assert.equal(joined.state.peers.find((peer: any) => peer.id === guestId)?.name, 'Verified Guest');
  assert.equal(joined.state.peers.find((peer: any) => peer.id === guestId)?.approved, false);

  guest.client.send({ type: 'offer', targetPeerId: created.hostId, sdp: { type: 'offer', sdp: 'blocked' } });
  assert.match((await guest.client.waitFor('error')).message, /not authorized/);

  host.client.send({ type: 'approve-peer', peerId: guestId, slot: 0 });
  const approved = await guest.client.waitFor('peer-approved');
  assert.equal(approved.state.peers.find((peer: any) => peer.id === guestId)?.approved, true);

  guest.client.send({ type: 'offer', targetPeerId: created.hostId, sdp: { type: 'offer', sdp: 'allowed' } });
  const forwarded = await host.client.waitFor('offer', message => message.fromPeerId === guestId);
  assert.equal(forwarded.sdp.sdp, 'allowed');

  guest.client.close();
  const wrongIdentity = await connect(origin, intruderCookie);
  clients.push(wrongIdentity.client);
  wrongIdentity.client.send({ type: 'resume-session', token: guest.token });
  await wrongIdentity.client.waitFor('session-resume-failed');

  const resumed = await connect(origin, guestCookie);
  clients.push(resumed.client);
  resumed.client.send({ type: 'resume-session', token: guest.token });
  const resumeState = await resumed.client.waitFor('session-resumed');
  assert.equal(resumeState.peerId, guestId);
  assert.equal(resumeState.state.roomCode, created.roomCode);
  assert.equal(resumeState.state.peers.find((peer: any) => peer.id === guestId)?.approved, true);
});
