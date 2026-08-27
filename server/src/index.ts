import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './room-manager.js';
import { DEFAULT_ICE_SERVERS } from './stun-turn.js';
import { ParsageMessage } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '7777', 10);
const HOST = process.env.HOST || '0.0.0.0';

const roomManager = new RoomManager();

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
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

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
    res.end(JSON.stringify({ iceServers: DEFAULT_ICE_SERVERS }));
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
const wss = new WebSocketServer({ server, path: '/ws' });
let nextClientId = 1;

wss.on('connection', (ws: WebSocket, req) => {
  const clientId = `peer-${Date.now().toString(36)}-${nextClientId++}`;
  const client = roomManager.registerClient(clientId, ws);

  ws.on('message', (data: Buffer | string) => {
    try {
      const msg: ParsageMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: msg.timestamp,
            serverTime: Date.now()
          }));
          break;

        case 'create-room': {
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
          roomManager.broadcastChat(clientId, msg.message);
          break;
        }

        case 'reaction': {
          roomManager.broadcastReaction(clientId, msg.emoji);
          break;
        }

        case 'offer':
        case 'answer':
        case 'ice-candidate': {
          if ('targetPeerId' in msg && msg.targetPeerId) {
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
    roomManager.removeClient(clientId);
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
