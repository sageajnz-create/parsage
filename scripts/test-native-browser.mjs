#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import readline from 'node:readline';
import { WebSocket } from '../server/node_modules/ws/wrapper.mjs';

const root = resolve(import.meta.dirname, '..');
const port = 17779;
const profile = mkdtempSync(join(tmpdir(), 'parsage-native-browser-'));
const children = [];
let host;

function child(command, args, options = {}) {
  const process = spawn(command, args, { cwd: root, ...options });
  children.push(process);
  return process;
}

function cleanup() {
  try { host?.close(); } catch {}
  for (const process of children) {
    try { process.kill('SIGTERM'); } catch {}
  }
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

function timeout(ms, message) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref();
  });
}

try {
  const server = child('node', ['server/dist/index.js'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let serverErrors = '';
  server.stderr.on('data', chunk => { serverErrors += chunk; });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) break;
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
    if (attempt === 49) throw new Error(`Server did not start: ${serverErrors}`);
  }

  host = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const queue = [];
  const waiters = [];
  host.on('message', data => {
    const message = JSON.parse(data.toString());
    const index = waiters.findIndex(waiter => waiter.predicate(message));
    if (index >= 0) waiters.splice(index, 1)[0].resolve(message);
    else queue.push(message);
  });
  await Promise.race([
    new Promise((resolveOpen, rejectOpen) => {
      host.once('open', resolveOpen);
      host.once('error', rejectOpen);
    }),
    timeout(5000, 'Signaling socket did not open.')
  ]);
  const next = predicate => {
    const index = queue.findIndex(predicate);
    if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
    return Promise.race([
      new Promise(resolveMessage => waiters.push({ predicate, resolve: resolveMessage })),
      timeout(12_000, 'Timed out waiting for signaling message.')
    ]);
  };

  host.send(JSON.stringify({
    type: 'create-room', name: 'Native Browser Test', settings: { requireApproval: true }
  }));
  const room = await next(message => message.type === 'room-created');
  const browser = child('chromium', [
    '--headless=new', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`,
    `http://127.0.0.1:${port}/?join=${room.roomCode}`
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let browserErrors = '';
  browser.stderr.on('data', chunk => { browserErrors += chunk; });

  const joined = await next(message => message.type === 'peer-joined');
  const targetPeerId = joined.peer.id;
  host.send(JSON.stringify({ type: 'approve-peer', peerId: targetPeerId, slot: 0 }));
  await next(message => message.type === 'room-state'
    && message.state.peers.some(peer => peer.id === targetPeerId && peer.approved));
  host.send(JSON.stringify({ type: 'native-media-start', targetPeerId }));

  const native = child('python3', [
    'host/native_pipeline.py', 'webrtc-peer', '--test-source', '--fps', '30', '--bitrate', '5'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  let nativeErrors = '';
  native.stderr.on('data', chunk => { nativeErrors += chunk; });

  host.on('message', data => {
    const message = JSON.parse(data.toString());
    if (message.fromPeerId !== targetPeerId) return;
    if (message.type === 'answer') {
      native.stdin.write(`${JSON.stringify({ type: 'answer', sdp: message.sdp.sdp })}\n`);
    } else if (message.type === 'ice-candidate') {
      native.stdin.write(`${JSON.stringify({
        type: 'ice-candidate',
        candidate: message.candidate.candidate,
        sdpMLineIndex: message.candidate.sdpMLineIndex || 0
      })}\n`);
    }
  });

  const connected = new Promise((resolveConnected, rejectConnected) => {
    readline.createInterface({ input: native.stdout }).on('line', line => {
      const message = JSON.parse(line);
      if (message.type === 'offer') {
        host.send(JSON.stringify({
          type: 'offer', targetPeerId, sdp: { type: 'offer', sdp: message.sdp }
        }));
      } else if (message.type === 'ice-candidate') {
        host.send(JSON.stringify({
          type: 'ice-candidate', targetPeerId,
          candidate: { candidate: message.candidate, sdpMLineIndex: message.sdpMLineIndex }
        }));
      } else if (message.type === 'connection-state' && message.state === 'connected') {
        resolveConnected(message);
      } else if (message.type === 'error') {
        rejectConnected(new Error(message.message));
      }
    });
  });
  await Promise.race([
    connected,
    timeout(25_000, `Native browser connection timed out. Native: ${nativeErrors} Browser: ${browserErrors.slice(-1000)}`)
  ]);

  console.log(JSON.stringify({
    connected: true,
    roomCode: room.roomCode,
    viewerPeerId: targetPeerId,
    transport: 'GStreamer H264/SCTP -> Chromium'
  }, null, 2));
} finally {
  cleanup();
}
