import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { AuthService } from './auth.js';
import { AccountRegistry } from './account.js';
import { DurableStore } from './store.js';
import { createParsageServer } from './server.js';

type Message = Record<string, any> & { type: string };

class Client {
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

  waitFor(type: string): Promise<Message> {
    const queuedIndex = this.queued.findIndex(message => message.type === type);
    if (queuedIndex >= 0) return Promise.resolve(this.queued.splice(queuedIndex, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate: (message: Message) => message.type === type,
        resolve,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for ${type}`));
        }, 3000)
      };
      this.waiters.push(waiter);
    });
  }

  close(): void {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) this.ws.close();
  }
}

test('account APIs persist friends, devices, presence, and revocable quick links', async (t) => {
  const store = DurableStore.memory();
  const accounts = new AccountRegistry(store);
  const auth = new AuthService('123-real-client.apps.googleusercontent.com', async credential => ({
    iss: 'https://accounts.google.com',
    aud: '123-real-client.apps.googleusercontent.com',
    sub: credential === 'host' ? 'google-host' : 'google-guest',
    email: credential === 'host' ? 'host@example.com' : 'guest@example.com',
    email_verified: true,
    name: credential === 'host' ? 'Host Sage' : 'Guest Ant',
    iat: 1,
    exp: 2
  }), accounts);
  const application = createParsageServer({
    auth,
    accounts,
    store,
    host: '127.0.0.1',
    port: 0,
    updateFetcher: async () => ({ tag_name: 'v0.2.0', html_url: 'https://github.com/sageajnz-create/parsage/releases/tag/v0.2.0' })
  });
  const clients: Client[] = [];
  t.after(async () => {
    for (const client of clients) client.close();
    await application.close();
  });

  const port = await application.listen();
  const origin = `http://127.0.0.1:${port}`;

  async function login(credential: string): Promise<string> {
    const response = await fetch(`${origin}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ credential })
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie')!.split(';', 1)[0];
  }

  const hostCookie = await login('host');
  const guestCookie = await login('guest');
  const headers = (cookie: string) => ({ cookie, Origin: origin, 'Content-Type': 'application/json' });

  const restartedAuth = new AuthService('123-real-client.apps.googleusercontent.com', async () => undefined, accounts);
  assert.equal(restartedAuth.getProfile(hostCookie)?.id, 'google-host');

  const hostWs = new WebSocket(origin.replace(/^http/, 'ws') + '/ws', { origin, headers: { Cookie: hostCookie } });
  const host = new Client(hostWs);
  clients.push(host);
  await new Promise<void>((resolve, reject) => {
    hostWs.once('open', resolve);
    hostWs.once('error', reject);
  });
  await host.waitFor('session-ready');
  host.send({ type: 'create-room', name: 'Host Sage', settings: { requireApproval: false } });
  const created = await host.waitFor('room-created');

  const linkResponse = await fetch(`${origin}/api/quick-links`, {
    method: 'POST',
    headers: headers(hostCookie),
    body: JSON.stringify({ roomCode: created.roomCode, expiresInMs: 60_000 })
  });
  assert.equal(linkResponse.status, 200);
  const link = await linkResponse.json() as { token: string; url: string; expiresAt: number };
  assert.match(link.url, /^\/\?link=/);

  const resolved = await fetch(`${origin}/api/quick-links/${encodeURIComponent(link.token)}`);
  assert.equal(resolved.status, 200);
  assert.equal((await resolved.json() as { roomCode: string }).roomCode, created.roomCode);

  const friend = await fetch(`${origin}/api/friends`, {
    method: 'POST',
    headers: headers(hostCookie),
    body: JSON.stringify({ handle: 'Guest Ant#' + 'google-guest'.slice(-4) })
  });
  assert.equal(friend.status, 200);
  const friends = await (await fetch(`${origin}/api/friends`, { headers: { cookie: hostCookie } })).json() as { friends: Array<{ status: string }> };
  assert.equal(friends.friends.length, 1);

  const device = await fetch(`${origin}/api/devices`, {
    method: 'POST',
    headers: headers(hostCookie),
    body: JSON.stringify({ name: 'Test Rig', platform: 'linux' })
  });
  assert.equal(device.status, 200);

  const bundle = await (await fetch(`${origin}/api/support-bundle`)).json() as { version: string; logs: unknown[]; configPresent: Record<string, unknown> };
  assert.equal(bundle.version, '0.2.0');
  assert.ok(Array.isArray(bundle.logs));
  assert.equal(bundle.configPresent.turnUrls, false);

  const revoke = await fetch(`${origin}/api/quick-links/${encodeURIComponent(link.token)}`, {
    method: 'DELETE',
    headers: headers(hostCookie)
  });
  assert.equal(revoke.status, 200);
  assert.equal((await fetch(`${origin}/api/quick-links/${encodeURIComponent(link.token)}`)).status, 410);

  const updates = await (await fetch(`${origin}/api/updates`)).json() as { current: string; updateAvailable: boolean };
  assert.equal(updates.current, '0.2.0');
  assert.equal(updates.updateAvailable, false);
});
