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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '7777', 10);
const HOST = process.env.HOST || '0.0.0.0';

const roomManager = new RoomManager();
const auth = new AuthService(process.env.GOOGLE_CLIENT_ID || '');
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';
const SECURE_COOKIE = process.env.COOKIE_SECURE === 'true';
const APPROVAL_TIMEOUT_MS = parseInt(process.env.APPROVAL_TIMEOUT_MS || '60000', 10);
const ROOM_MAX_AGE_MS = parseInt(process.env.ROOM_MAX_AGE_MS || String(12 * 60 * 60_000), 10);

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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
    json(res, 200, { profile: auth.getProfile(req.headers.cookie) });
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
    res.setHeader('Set-Cookie', auth.clearCookie(SECURE_COOKIE));
    json(res, 200, { ok: true });
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
      app: 'Parsage',
      version: '0.1.0',
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
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
let nextClientId = 1;
const reconnectGraceMs = 15_000;
const reconnectTokens = new ReconnectRegistry();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

wss.on('connection', (ws: WebSocket, req) => {
  let clientId = `peer-${Date.now().toString(36)}-${nextClientId++}`;
  const authProfile = auth.getProfile(req.headers.cookie);
  roomManager.registerClient(clientId, ws, authProfile?.name || 'Anonymous', authProfile?.id || null);
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
          if (typeof msg.name !== 'string' || msg.name.trim().length === 0) break;
          msg.name = authProfile?.name || msg.name.trim().slice(0, 64);
          const { roomCode, state } = roomManager.createRoom(clientId, msg.name, msg.settings);
          console.log(`[Parsage] Room created: ${roomCode} by Host "${msg.name}" (${clientId})`);
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
          const result = roomManager.joinRoom(clientId, msg.roomCode, msg.name, msg.role);
          if (result.success && result.state) {
            console.log(`[Parsage] Peer "${msg.name}" (${clientId}) joined room ${result.state.roomCode}`);
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
        case 'native-media-start': {
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
      console.error(`[Parsage] Error processing message from ${clientId}:`, err);
    }
  });

  ws.on('close', (code, reason) => {
    if (roomManager.getClient(clientId)?.ws !== ws) return;
    const existing = disconnectTimers.get(clientId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      roomManager.removeClient(clientId);
      disconnectTimers.delete(clientId);
      reconnectTokens.remove(clientId);
    }, reconnectGraceMs);
    timer.unref();
    disconnectTimers.set(clientId, timer);
  });

  ws.on('error', (err) => {
    console.error(`[Parsage] WebSocket error for ${clientId}:`, err);
  });
});

server.listen(PORT, HOST, () => {
  const lanIps = getLocalIpAddresses();
  console.log(`
============================================================
  🌿 PARSAGE SIGNALING & STREAM HUB
  Created by Sage & Antigravity
============================================================
  🚀 Local URL:  http://localhost:${PORT}
  📡 LAN Direct: ${lanIps.map(ip => `http://${ip}:${PORT}`).join(', ') || 'None'}
  ⚡ WebSocket:  ws://${HOST}:${PORT}/ws
============================================================
  `);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
