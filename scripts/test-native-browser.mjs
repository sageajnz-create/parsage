#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import readline from 'node:readline';
import { WebSocket } from '../server/node_modules/ws/wrapper.mjs';

const root = resolve(import.meta.dirname, '..');
const port = 17779;
const debuggingPort = 19223;
const usePortal = process.argv.includes('--portal');
const useSoftwareEncoder = process.argv.includes('--software');
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

async function browserMediaState() {
  const pages = await fetch(`http://127.0.0.1:${debuggingPort}/json`).then(response => response.json());
  const page = pages.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
  if (!page) throw new Error('Chromium debugging page was not available.');
  const debug = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    debug.once('open', resolveOpen);
    debug.once('error', rejectOpen);
  });
  const result = await new Promise((resolveResult, rejectResult) => {
    const timer = setTimeout(() => rejectResult(new Error('Chromium media-state query timed out.')), 3000);
    debug.on('message', data => {
      const message = JSON.parse(data.toString());
      if (message.id !== 1) return;
      clearTimeout(timer);
      resolveResult(message.result.result.value);
    });
    debug.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => { const video = document.querySelector('video'); const quality = video?.getVideoPlaybackQuality?.(); return video ? { width: video.videoWidth, height: video.videoHeight, readyState: video.readyState, currentTime: video.currentTime, decodedFrames: quality?.totalVideoFrames ?? video.webkitDecodedFrameCount ?? 0 } : null; })()`,
        returnByValue: true
      }
    }));
  });
  debug.close();
  return result;
}

try {
  const server = child('node', ['server/dist/index.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      PARSAGE_STORE_PATH: join(tmpdir(), `parsage-native-store-${port}.json`),
      PARSAGE_CRASH_PATH: join(tmpdir(), `parsage-native-crash-${port}.json`),
    },
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
    '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profile}`,
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

  if (usePortal) {
    child('gst-launch-1.0', [
      '-q', 'videotestsrc', 'is-live=true', 'pattern=ball', '!',
      'video/x-raw,width=640,height=360,framerate=60/1', '!', 'videoconvert', '!', 'autovideosink'
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    await new Promise(resolveWait => setTimeout(resolveWait, 750));
  }

  const nativeArgs = [
    'host/native_pipeline.py', 'webrtc-peer', '--fps', '60', '--bitrate', '25'
  ];
  if (!usePortal) nativeArgs.push('--test-source');
  else if (useSoftwareEncoder) nativeArgs.push('--encoder', 'h264_software');
  const native = child('python3', nativeArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
  let nativeErrors = '';
  let nativeEncoder = null;
  let nativeStats = { encoded_frames: 0 };
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
      } else if (message.type === 'ready') {
        nativeEncoder = message.encoder;
      } else if (message.type === 'stats') {
        nativeStats = { encoded_frames: message.encoded_frames };
      } else if (message.type === 'error') {
        rejectConnected(new Error(message.message));
      }
    });
  });
  await Promise.race([
    connected,
    timeout(usePortal ? 120_000 : 25_000, `Native browser connection timed out. Native: ${nativeErrors} Browser: ${browserErrors.slice(-1000)}`)
  ]);

  let media = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
    try {
      media = await browserMediaState();
      if (media?.width > 0 && media?.height > 0 && media?.readyState >= 2) break;
    } catch {}
  }
  if (!media?.width || !media?.height || media.readyState < 2) {
    throw new Error(`Chromium connected but did not decode a video frame: ${JSON.stringify(media)}`);
  }
  const firstDecodedFrames = media.decodedFrames;
  await new Promise(resolveWait => setTimeout(resolveWait, 1000));
  media = await browserMediaState();
  if (!usePortal && media.decodedFrames <= firstDecodedFrames) {
    throw new Error(`Chromium decoded a frame but the frame count did not advance. Media: ${JSON.stringify(media)} Native: ${JSON.stringify(nativeStats)}`);
  }

  console.log(JSON.stringify({
    connected: true,
    roomCode: room.roomCode,
    viewerPeerId: targetPeerId,
    transport: 'GStreamer H264/SCTP -> Chromium',
    source: usePortal ? 'PipeWire portal display' : 'deterministic test pattern',
    encoder: nativeEncoder,
    nativeStats,
    decodedVideo: media
  }, null, 2));
} finally {
  cleanup();
}
