import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './room-manager.js';
import { getIceServers } from './stun-turn.js';
import { ParsageMessage } from './types.js';
import { AuthService } from './auth.js';
import { ReconnectRegistry } from './reconnect.js';
import { AccountRegistry } from './account.js';
import { DurableStore } from './store.js';
import { Logger, createLogger } from './log.js';
import { buildSupportBundle } from './support-bundle.js';
import { checkForUpdate } from './updates.js';
import { clearCrashMarker, readCrashMarker } from './crash.js';
import { APP_NAME, APP_VERSION } from './version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ParsageServerOptions {
  port?: number;
  host?: string;
  auth?: AuthService;
  requireAuth?: boolean;
  secureCookie?: boolean;
  approvalTimeoutMs?: number;
  roomMaxAgeMs?: number;
  reconnectGraceMs?: number;
  store?: DurableStore;
  accounts?: AccountRegistry;
  logger?: Logger;
  now?: () => number;
  updateFetcher?: (url: string) => Promise<{ tag_name?: string; html_url?: string } | null>;
}

export interface ParsageServer {
  server: http.Server;
  wss: WebSocketServer;
  listen(): Promise<number>;
  close(): Promise<void>;
}

export function createParsageServer(options: ParsageServerOptions = {}): ParsageServer {
const PORT = options.port ?? parseInt(process.env.PORT || '7777', 10);
const HOST = options.host ?? (process.env.HOST || '0.0.0.0');

const roomManager = new RoomManager();
const store = options.store ?? DurableStore.memory();
const accounts = options.accounts ?? new AccountRegistry(store, options.now);
const logger = options.logger ?? createLogger();
const auth = options.auth ?? new AuthService(process.env.GOOGLE_CLIENT_ID || '', undefined, accounts);
const REQUIRE_AUTH = options.requireAuth ?? process.env.REQUIRE_AUTH === 'true';
const SECURE_COOKIE = options.secureCookie ?? process.env.COOKIE_SECURE === 'true';
const APPROVAL_TIMEOUT_MS = options.approvalTimeoutMs ?? parseInt(process.env.APPROVAL_TIMEOUT_MS || '60000', 10);
const ROOM_MAX_AGE_MS = options.roomMaxAgeMs ?? parseInt(process.env.ROOM_MAX_AGE_MS || String(12 * 60 * 60_000), 10);

const cleanupTimer = setInterval(() => {
  roomManager.expirePending(Date.now(), APPROVAL_TIMEOUT_MS);
  roomManager.expireRooms(Date.now(), ROOM_MAX_AGE_MS);
}, 15_000);
cleanupTimer.unref();

// Get local IPv4 addresses for LAN direct-connect
function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Create HTTP Server
function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 16 * 1024) throw new Error('Request body too large.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isSameOrigin(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
}

function isAllowedWebSocketOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  return origin === `http://${host}` || origin === `https://${host}`;
}

function actorFrom(req: http.IncomingMessage) {
  return auth.getActor(req.headers.cookie);
}

function requireActor(req: http.IncomingMessage, res: http.ServerResponse) {
  const actor = actorFrom(req);
  if (!actor) {
    json(res, 401, { error: 'Sign in or save a local Parsage identity first.' });
    return null;
  }
  return actor;
}

function setCookies(res: http.ServerResponse, cookies: string[]) {
  res.setHeader('Set-Cookie', cookies);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/api/auth/config') {
    json(res, 200, { configured: auth.configured, clientId: auth.configured ? auth.clientId : null, requireAuth: REQUIRE_AUTH });
    return;
  }

  if (url.pathname === '/api/auth/me') {
    json(res, 200, {
      profile: auth.getProfile(req.headers.cookie),
      actor: actorFrom(req)
    });
    return;
  }

  if (url.pathname === '/api/auth/google' && req.method === 'POST') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin authentication request rejected.' });
      return;
    }
    try {
      const body = await readJson(req);
      const credential = typeof body.credential === 'string' ? body.credential : '';
      const session = await auth.login(credential);
      res.setHeader('Set-Cookie', auth.sessionCookie(session.token, SECURE_COOKIE));
      json(res, 200, { profile: session.profile });
    } catch (error) {
      console.warn('[Auth] Google login rejected:', error instanceof Error ? error.message : error);
      json(res, 401, { error: 'Google authentication failed.' });
    }
    return;
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin authentication request rejected.' });
      return;
    }
    auth.logout(req.headers.cookie);
    setCookies(res, [auth.clearCookie(SECURE_COOKIE), auth.clearLocalCookie(SECURE_COOKIE)]);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/account/local' && req.method === 'POST') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin identity request rejected.' });
      return;
    }
    try {
      const body = await readJson(req);
      const existing = actorFrom(req);
      if (existing?.kind === 'local') {
        const updated = accounts.updateIdentity(existing.id, {
          name: typeof body.name === 'string' ? body.name : existing.name,
          tag: typeof body.tag === 'string' ? body.tag : existing.tag,
          avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : existing.avatarUrl
        });
        json(res, 200, { actor: updated ? accounts.toPublic(updated) : existing });
        return;
      }
      if (existing?.kind === 'google') {
        json(res, 200, { actor: existing });
        return;
      }
      const created = auth.createLocalActor({
        name: typeof body.name === 'string' ? body.name : 'Gamer',
        tag: typeof body.tag === 'string' ? body.tag : undefined,
        avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined
      });
      setCookies(res, [auth.localCookie(created.token, SECURE_COOKIE)]);
      json(res, 200, { actor: created.identity });
    } catch (error) {
      logger.warn('local_identity_failed', { message: error instanceof Error ? error.message : String(error) });
      json(res, 400, { error: error instanceof Error ? error.message : 'Unable to save local identity.' });
    }
    return;
  }

  if (url.pathname === '/api/friends' && req.method === 'GET') {
    const actor = requireActor(req, res);
    if (!actor) return;
    json(res, 200, { friends: accounts.listFriends(actor.id) });
    return;
  }

  if (url.pathname === '/api/friends' && req.method === 'POST') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin friend request rejected.' });
      return;
    }
    const actor = requireActor(req, res);
    if (!actor) return;
    try {
      const body = await readJson(req);
      const handle = typeof body.handle === 'string' ? body.handle : '';
      const friend = accounts.addFriend(actor.id, handle);
      logger.info('friend_added', { actorId: actor.id, friendId: friend.id });
      json(res, 200, { friend });
    } catch (error) {
      json(res, 404, { error: error instanceof Error ? error.message : 'Friend not found.' });
    }
    return;
  }

  if (url.pathname.startsWith('/api/friends/') && req.method === 'DELETE') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin friend request rejected.' });
      return;
    }
    const actor = requireActor(req, res);
    if (!actor) return;
    const friendId = decodeURIComponent(url.pathname.slice('/api/friends/'.length));
    accounts.removeFriend(actor.id, friendId);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/devices' && req.method === 'GET') {
    const actor = requireActor(req, res);
    if (!actor) return;
    json(res, 200, { devices: accounts.listDevices(actor.id) });
    return;
  }

  if (url.pathname === '/api/devices' && req.method === 'POST') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin device request rejected.' });
      return;
    }
    const actor = requireActor(req, res);
    if (!actor) return;
    const body = await readJson(req).catch(() => ({} as Record<string, unknown>));
    const device = accounts.registerDevice(actor.id, {
      name: typeof body.name === 'string' ? body.name : `${os.hostname()} host`,
      platform: typeof body.platform === 'string' ? body.platform : process.platform,
      gpu: typeof body.gpu === 'string' ? body.gpu : undefined
    });
    logger.info('device_registered', { actorId: actor.id, deviceId: device.id });
    json(res, 200, { device });
    return;
  }

  if (url.pathname.startsWith('/api/devices/') && req.method === 'DELETE') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin device request rejected.' });
      return;
    }
    const actor = requireActor(req, res);
    if (!actor) return;
    const deviceId = decodeURIComponent(url.pathname.slice('/api/devices/'.length));
    if (!accounts.removeDevice(actor.id, deviceId)) {
      json(res, 404, { error: 'Device not found.' });
      return;
    }
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/quick-links' && req.method === 'GET') {
    const actor = requireActor(req, res);
    if (!actor) return;
    json(res, 200, {
      links: accounts.listQuickLinks(actor.id).map(link => ({
        roomCode: link.roomCode,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        revoked: Boolean(link.revokedAt)
      }))
    });
    return;
  }

  if (url.pathname === '/api/quick-links' && req.method === 'POST') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin quick link request rejected.' });
      return;
    }
    const actor = requireActor(req, res);
    if (!actor) return;
    const body = await readJson(req).catch(() => ({} as Record<string, unknown>));
    const roomCode = typeof body.roomCode === 'string' ? body.roomCode.trim().toUpperCase() : '';
    const expiresInMs = typeof body.expiresInMs === 'number' ? body.expiresInMs : 24 * 60 * 60_000;
    if (!roomManager.getRoom(roomCode)) {
      json(res, 404, { error: 'Room does not exist or has expired.' });
      return;
    }
    const room = roomManager.getRoom(roomCode);
    const host = room?.hostId ? roomManager.getClient(room.hostId) : undefined;
    if (host?.authUserId && host.authUserId !== actor.id) {
      json(res, 403, { error: 'Only the host identity can create a quick link for this room.' });
      return;
    }
    const created = accounts.createQuickLink(actor.id, roomCode, expiresInMs);
    logger.info('quick_link_created', { actorId: actor.id, expiresAt: created.link.expiresAt });
    json(res, 200, {
      token: created.token,
      url: `/?link=${encodeURIComponent(created.token)}`,
      expiresAt: created.link.expiresAt
    });
    return;
  }

  if (url.pathname.startsWith('/api/quick-links/') && req.method === 'GET') {
    const token = decodeURIComponent(url.pathname.slice('/api/quick-links/'.length));
    const link = accounts.resolveQuickLink(token);
    if (!link) {
      json(res, 410, { error: 'This share link has expired or been revoked.' });
      return;
    }
    json(res, 200, { roomCode: link.roomCode, expiresAt: link.expiresAt });
    return;
  }

  if (url.pathname.startsWith('/api/quick-links/') && req.method === 'DELETE') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin quick link request rejected.' });
      return;
    }
    const actor = requireActor(req, res);
    if (!actor) return;
    const token = decodeURIComponent(url.pathname.slice('/api/quick-links/'.length));
    if (!accounts.revokeQuickLink(actor.id, token)) {
      json(res, 404, { error: 'Quick link not found.' });
      return;
    }
    logger.info('quick_link_revoked', { actorId: actor.id });
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/support-bundle' && req.method === 'GET') {
    const bundle = buildSupportBundle({
      accounts,
      logs: logger.recent(),
      uptime: process.uptime()
    });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="parsage-support-${APP_VERSION}.json"`,
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(bundle, null, 2));
    return;
  }

  if (url.pathname === '/api/crash' && req.method === 'GET') {
    json(res, 200, { crash: readCrashMarker() });
    return;
  }

  if (url.pathname === '/api/crash' && req.method === 'DELETE') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin crash request rejected.' });
      return;
    }
    clearCrashMarker();
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/updates' && req.method === 'GET') {
    json(res, 200, await checkForUpdate({ fetchRelease: options.updateFetcher }));
    return;
  }

  if (url.pathname === '/api/auth/pair/start' && req.method === 'POST') {
    if (!auth.configured || !isSameOrigin(req)) {
      json(res, auth.configured ? 403 : 503, { error: 'Desktop authentication pairing is unavailable.' });
      return;
    }
    const pairing = auth.createPairing();
    json(res, 200, {
      ...pairing,
      url: `http://127.0.0.1:${PORT}/?authPair=${encodeURIComponent(pairing.id)}`
    });
    return;
  }

  if (url.pathname === '/api/auth/pair/complete' && req.method === 'POST') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin pairing request rejected.' });
      return;
    }
    const profile = auth.getProfile(req.headers.cookie);
    const body: Record<string, unknown> = await readJson(req).catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    if (!profile || !auth.completePairing(id, profile)) {
      json(res, 401, { error: 'Authentication pairing failed or expired.' });
      return;
    }
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/auth/pair/claim' && req.method === 'POST') {
    if (!isSameOrigin(req)) {
      json(res, 403, { error: 'Cross-origin pairing request rejected.' });
      return;
    }
    const body: Record<string, unknown> = await readJson(req).catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    const secret = typeof body.secret === 'string' ? body.secret : '';
    const session = auth.claimPairing(id, secret);
    if (!session) {
      json(res, 202, { pending: true });
      return;
    }
    res.setHeader('Set-Cookie', auth.sessionCookie(session.token, SECURE_COOKIE));
    json(res, 200, { profile: session.profile });
    return;
  }

  if (url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      app: APP_NAME,
      version: APP_VERSION,
      tagline: 'Plug-and-play low-latency game & desktop streaming for Linux and friends',
      credits: 'Created by Sage & Antigravity',
      uptime: process.uptime(),
      serverTime: Date.now(),
      platform: process.platform,
      arch: process.arch,
      lanIps: getLocalIpAddresses()
    }));
    return;
  }

  if (url.pathname === '/api/lan-info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      port: PORT,
      lanIps: getLocalIpAddresses(),
      directUrls: getLocalIpAddresses().map(ip => `http://${ip}:${PORT}`)
    }));
    return;
  }

  if (url.pathname === '/api/ice-servers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ iceServers: getIceServers() }));
    return;
  }

  // Serve static web build if present
  const webDistPath = path.resolve(__dirname, '../../web/dist');
  let filePath = path.join(webDistPath, url.pathname === '/' ? 'index.html' : url.pathname);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback to index.html for SPA routing
  const indexPath = path.join(webDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Parsage Signaling Server</title>
        <style>
          body { background: #1B1A17; color: #F3E5AB; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .card { background: #272520; border: 2px solid #FFC72C; border-radius: 12px; padding: 32px; text-align: center; }
          h1 { color: #1EB53A; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🌿 PARSAGE</h1>
          <p>Created by <strong>Sage & Antigravity</strong></p>
          <p>Signal Hub is running on port ${PORT}</p>
        </div>
      </body>
    </html>
  `);
});

// Create WebSocket Server
const verifyWebSocketClient: WebSocket.VerifyClientCallbackSync = ({ origin, req }) => (
  isAllowedWebSocketOrigin(origin, req.headers.host)
);
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 64 * 1024,
  verifyClient: verifyWebSocketClient,
});
let nextClientId = 1;
const reconnectGraceMs = options.reconnectGraceMs ?? 15_000;
const reconnectTokens = new ReconnectRegistry();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

wss.on('connection', (ws: WebSocket, req) => {
  let clientId = `peer-${Date.now().toString(36)}-${nextClientId++}`;
  const actor = actorFrom(req);
  const authProfile = auth.getProfile(req.headers.cookie);
  const displayName = actor?.name || authProfile?.name || 'Anonymous';
  const authUserId = actor?.id || authProfile?.id || null;
  roomManager.registerClient(clientId, ws, displayName, authUserId);
  if (authUserId) accounts.setPresence(authUserId, 'online');
  let reconnectToken = reconnectTokens.issue(clientId);
  ws.send(JSON.stringify({ type: 'session-ready', token: reconnectToken }));
  let rateWindowStartedAt = Date.now();
  let messagesInWindow = 0;
  let joinWindowStartedAt = Date.now();
  let joinsInWindow = 0;

  ws.on('message', (data: Buffer | string) => {
    try {
      const now = Date.now();
      if (now - rateWindowStartedAt >= 10_000) {
        rateWindowStartedAt = now;
        messagesInWindow = 0;
      }
      if (++messagesInWindow > 500) {
        ws.close(4008, 'Signaling rate limit exceeded');
        return;
      }
      const msg: ParsageMessage = JSON.parse(data.toString());
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'resume-session': {
          if (typeof msg.token !== 'string') break;
          const previousClientId = reconnectTokens.resolve(msg.token);
          if (!previousClientId || previousClientId === clientId) {
            ws.send(JSON.stringify({ type: 'session-resume-failed' }));
            break;
          }
          const previousClient = roomManager.reconnectClient(previousClientId, ws, authProfile?.id || null);
          if (!previousClient) {
            ws.send(JSON.stringify({ type: 'session-resume-failed' }));
            break;
          }
          roomManager.removeClient(clientId);
          reconnectToken = reconnectTokens.rotate(previousClientId, clientId, reconnectToken);
          const timer = disconnectTimers.get(previousClientId);
          if (timer) clearTimeout(timer);
          disconnectTimers.delete(previousClientId);
          clientId = previousClientId;
          const room = previousClient.roomCode ? roomManager.getRoom(previousClient.roomCode) || null : null;
          ws.send(JSON.stringify({
            type: 'session-resumed',
            peerId: previousClientId,
            state: room,
            isHost: previousClient.role === 'host'
          }));
          break;
        }

        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: msg.timestamp,
            serverTime: Date.now()
          }));
          break;

        case 'create-room': {
          if (REQUIRE_AUTH && !authProfile) {
            ws.send(JSON.stringify({ type: 'error', message: 'Sign in is required to host a room.' }));
            break;
          }
          if (roomManager.getClient(clientId)?.roomCode) {
            ws.send(JSON.stringify({ type: 'error', message: 'Leave the current room before hosting another.' }));
            break;
          }
          if (typeof msg.name !== 'string' || msg.name.trim().length === 0) break;
          msg.name = authProfile?.name || msg.name.trim().slice(0, 64);
          const { roomCode, state } = roomManager.createRoom(clientId, msg.name, msg.settings);
          logger.info('room_created', { roomCode });
          if (authUserId) {
            accounts.setPresence(authUserId, 'hosting', { roomCode });
            accounts.touchDevice(authUserId, roomCode);
          }
          ws.send(JSON.stringify({
            type: 'room-created',
            roomCode,
            hostId: clientId,
            state
          }));
          break;
        }

        case 'join-room': {
          if (REQUIRE_AUTH && !authProfile) {
            ws.send(JSON.stringify({ type: 'error', message: 'Sign in is required to join a room.' }));
            break;
          }
          if (roomManager.getClient(clientId)?.roomCode) {
            ws.send(JSON.stringify({ type: 'error', message: 'Leave the current room before joining another.' }));
            break;
          }
          if (now - joinWindowStartedAt >= 60_000) {
            joinWindowStartedAt = now;
            joinsInWindow = 0;
          }
          if (++joinsInWindow > 5) {
            ws.send(JSON.stringify({ type: 'error', message: 'Too many room join attempts. Try again later.' }));
            break;
          }
          if (typeof msg.roomCode !== 'string' || typeof msg.name !== 'string') break;
          msg.name = authProfile?.name || msg.name.trim().slice(0, 64) || 'Guest';
          const role = msg.role === 'agent' ? 'agent' : 'client';
          const result = roomManager.joinRoom(clientId, msg.roomCode, msg.name, role);
          if (result.success && result.state) {
            logger.info('room_joined', { roomCode: result.state.roomCode });
            if (authUserId) accounts.setPresence(authUserId, 'in-game', { roomCode: result.state.roomCode });
            ws.send(JSON.stringify({
              type: 'room-joined',
              roomCode: result.state.roomCode,
              peerId: clientId,
              state: result.state
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: result.error || 'Failed to join room'
            }));
          }
          break;
        }

        case 'approve-peer': {
          roomManager.approvePeer(clientId, msg.peerId, msg.slot);
          break;
        }

        case 'claim-slot': {
          roomManager.claimSlot(clientId, msg.slot);
          break;
        }

        case 'release-slot': {
          roomManager.releaseSlot(clientId, msg.slot);
          break;
        }

        case 'update-permissions': {
          roomManager.updatePermissions(clientId, msg.peerId, msg.permissions);
          break;
        }

        case 'kick-peer': {
          roomManager.kickPeer(clientId, msg.peerId);
          break;
        }

        case 'chat': {
          if (typeof msg.message === 'string') roomManager.broadcastChat(clientId, msg.message.trim().slice(0, 500));
          break;
        }

        case 'reaction': {
          if (typeof msg.emoji === 'string') roomManager.broadcastReaction(clientId, msg.emoji.slice(0, 16));
          break;
        }

        case 'offer':
        case 'answer':
        case 'ice-candidate':
        case 'native-media-start':
        case 'media-capabilities': {
          if ('targetPeerId' in msg && msg.targetPeerId) {
            if (!roomManager.canExchangeRtc(clientId, msg.targetPeerId)) {
              ws.send(JSON.stringify({ type: 'error', message: 'RTC exchange is not authorized for this peer.' }));
              break;
            }
            const forwardMsg = {
              ...msg,
              fromPeerId: clientId
            };
            roomManager.sendToPeer(msg.targetPeerId, forwardMsg as any);
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      logger.error('signaling_message_failed', { message: err instanceof Error ? err.message : String(err) });
    }
  });

  ws.on('close', (code, reason) => {
    if (roomManager.getClient(clientId)?.ws !== ws) return;
    const existing = disconnectTimers.get(clientId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      const removed = roomManager.getClient(clientId);
      const identityId = removed?.authUserId;
      roomManager.removeClient(clientId);
      disconnectTimers.delete(clientId);
      reconnectTokens.remove(clientId);
      if (identityId) accounts.setPresence(identityId, 'offline');
    }, reconnectGraceMs);
    timer.unref();
    disconnectTimers.set(clientId, timer);
  });

  ws.on('error', (err) => {
    logger.error('websocket_error', { message: err instanceof Error ? err.message : String(err) });
  });
});

const listen = (): Promise<number> => new Promise((resolve, reject) => {
  const onError = (error: Error) => reject(error);
  server.once('error', onError);
  server.listen(PORT, HOST, () => {
    server.off('error', onError);
    const address = server.address();
    const listeningPort = address && typeof address === 'object' ? address.port : PORT;
    const lanIps = getLocalIpAddresses();
    logger.info('server_listening', {
      port: listeningPort,
      lanIps
    });
    console.log(`
============================================================
  🌿 PARSAGE SIGNALING & STREAM HUB
  Created by Sage & Antigravity
============================================================
  🚀 Local URL:  http://localhost:${listeningPort}
  📡 LAN Direct: ${lanIps.map(ip => `http://${ip}:${listeningPort}`).join(', ') || 'None'}
  ⚡ WebSocket:  ws://${HOST}:${listeningPort}/ws
============================================================
  `);
    resolve(listeningPort);
  });
});

const close = async (): Promise<void> => {
  clearInterval(cleanupTimer);
  for (const timer of disconnectTimers.values()) clearTimeout(timer);
  disconnectTimers.clear();
  for (const client of wss.clients) client.terminate();
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
};

return { server, wss, listen, close };
}
