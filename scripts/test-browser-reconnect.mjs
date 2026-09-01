#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { WebSocket } from '../server/node_modules/ws/wrapper.mjs';

const root = resolve(import.meta.dirname, '..');
const port = 17780;
const debuggingPort = 19224;
const profile = mkdtempSync(join(tmpdir(), 'parsage-browser-reconnect-'));
const children = [];
let host;
let debug;

function browserExecutable() {
  const configured = process.env.BROWSER_BIN || process.env.CHROME_BIN;
  const candidates = process.platform === 'win32'
    ? [
        configured,
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ]
    : [
        configured,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/opt/google/chrome/chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
      ];
  const executable = candidates.find(candidate => candidate && existsSync(candidate));
  if (!executable) throw new Error('No supported Chromium browser found. Set BROWSER_BIN to its executable.');
  return executable;
}

function child(command, args, options = {}) {
  const process = spawn(command, args, { cwd: root, ...options });
  children.push(process);
  return process;
}

function cleanup() {
  try { debug?.close(); } catch {}
  try { host?.close(); } catch {}
  for (const process of children) {
    try { process.kill('SIGTERM'); } catch {}
  }
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timeout(ms, message) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref();
  });
}

async function waitForHttp(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForDebuggerPages(port, browserProcess, stderr) {
  let lastError = 'no response';
  for (let attempt = 0; attempt < 200; attempt++) {
    if (browserProcess.exitCode !== null) {
      throw new Error(`Browser exited with code ${browserProcess.exitCode}: ${stderr()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) {
        const pages = await response.json();
        if (Array.isArray(pages) && pages.some(page => page.type === 'page' && page.webSocketDebuggerUrl)) {
          return pages;
        }
        lastError = `debugger returned ${JSON.stringify(pages)}`;
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error.message;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for http://127.0.0.1:${port}/json (${lastError})`);
}

class CdpClient {
  nextId = 1;
  pending = new Map();

  constructor(socket) {
    this.socket = socket;
    socket.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 5000);
      timer.unref();
      this.pending.set(id, {
        resolve: result => { clearTimeout(timer); resolve(result); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
    return result.result.value;
  }
}

const instrumentation = String.raw`
(() => {
  const NativeWebSocket = window.WebSocket;
  window.__parsageTestSockets = [];
  window.WebSocket = class TrackedWebSocket extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      window.__parsageTestSockets.push(this);
    }
  };

  window.__parsageTestPeerConnections = [];
  let offerSequence = 0;
  class FakeDataChannel {
    readyState = 'open';
    onopen = null;
    onclose = null;
    onmessage = null;
    send() {}
    close() { this.readyState = 'closed'; this.onclose?.(); }
  }
  class FakePeerConnection {
    connectionState = 'connected';
    signalingState = 'stable';
    localDescription = null;
    remoteDescription = null;
    restartIceCalls = 0;
    offerOptions = [];
    transceivers = [];
    onconnectionstatechange = null;
    onicecandidate = null;
    ontrack = null;
    ondatachannel = null;
    constructor(configuration) {
      this.configuration = configuration;
      window.__parsageTestPeerConnections.push(this);
    }
    createDataChannel() { return new FakeDataChannel(); }
    addTransceiver(kind, init = {}) {
      const transceiver = {
        direction: init.direction || 'sendrecv',
        receiver: { track: { kind } },
        sender: {
          track: null,
          getParameters() { return { encodings: [{}] }; },
          async setParameters() {},
          async generateKeyFrame() {},
        },
        setCodecPreferences() {},
      };
      this.transceivers.push(transceiver);
      return transceiver;
    }
    getTransceivers() { return this.transceivers; }
    getSenders() { return this.transceivers.map(item => item.sender); }
    addTrack(track) {
      const sender = {
        track,
        getParameters() { return { encodings: [{}] }; },
        async setParameters() {},
        async generateKeyFrame() {},
      };
      this.transceivers.push({
        direction: 'sendonly',
        receiver: { track: { kind: track.kind } },
        sender,
        setCodecPreferences() {},
      });
      return sender;
    }
    async getStats() { return new Map(); }
    async createOffer(options = {}) {
      this.offerOptions.push({ ...options });
      offerSequence += 1;
      return { type: 'offer', sdp: 'v=0\\r\\na=ice-ufrag:fake-' + offerSequence + '\\r\\n' };
    }
    async createAnswer() { return { type: 'answer', sdp: 'v=0\\r\\n' }; }
    async setLocalDescription(description) {
      if (description?.type === 'rollback') {
        this.localDescription = null;
        this.signalingState = 'stable';
        return;
      }
      this.localDescription = description;
      this.signalingState = description?.type === 'offer' ? 'have-local-offer' : 'stable';
    }
    async setRemoteDescription(description) {
      this.remoteDescription = description;
      if (description?.type === 'answer') this.signalingState = 'stable';
    }
    async addIceCandidate() {}
    restartIce() { this.restartIceCalls += 1; }
    close() { this.connectionState = 'closed'; this.signalingState = 'closed'; }
  }
  window.RTCPeerConnection = FakePeerConnection;
  window.RTCSessionDescription = class { constructor(init) { Object.assign(this, init); } };
  window.RTCIceCandidate = class { constructor(init) { Object.assign(this, init); } };
})();
`;

try {
  const server = child(process.execPath, ['server/dist/index.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      PARSAGE_STORE_PATH: join(tmpdir(), `parsage-browser-store-${port}.json`),
      PARSAGE_CRASH_PATH: join(tmpdir(), `parsage-browser-crash-${port}.json`),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverErrors = '';
  server.stderr.on('data', chunk => { serverErrors += chunk.toString(); });
  await waitForHttp(`http://127.0.0.1:${port}/api/status`).catch(error => {
    throw new Error(`${error.message}: ${serverErrors}`);
  });

  host = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const queue = [];
  const waiters = [];
  host.on('message', raw => {
    const message = JSON.parse(raw.toString());
    const index = waiters.findIndex(waiter => waiter.predicate(message));
    if (index >= 0) waiters.splice(index, 1)[0].resolve(message);
    else queue.push(message);
  });
  await Promise.race([
    new Promise((resolveOpen, rejectOpen) => {
      host.once('open', resolveOpen);
      host.once('error', rejectOpen);
    }),
    timeout(5000, 'Host signaling socket did not open.'),
  ]);
  const next = (predicate, message = 'Timed out waiting for signaling message.') => {
    const index = queue.findIndex(predicate);
    if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
    return Promise.race([
      new Promise(resolve => waiters.push({ predicate, resolve })),
      timeout(12_000, message),
    ]);
  };

  host.send(JSON.stringify({
    type: 'create-room',
    name: 'Browser Reconnect Test',
    settings: { requireApproval: true },
  }));
  const room = await next(message => message.type === 'room-created');

  const browser = child(browserExecutable(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let browserErrors = '';
  browser.stderr.on('data', chunk => { browserErrors += chunk.toString(); });

  const pages = await waitForDebuggerPages(debuggingPort, browser, () => browserErrors.slice(-2000)).catch(error => {
    throw new Error(
      `${error.message}; browser exit=${browser.exitCode}; stderr=${browserErrors.slice(-2000)}`,
    );
  });
  const page = pages.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
  if (!page) throw new Error(`No Chromium debugging page found: ${browserErrors}`);
  debug = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    debug.once('open', resolveOpen);
    debug.once('error', rejectOpen);
  });
  const cdp = new CdpClient(debug);
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: instrumentation });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/?join=${room.roomCode}` });

  const joined = await next(
    message => message.type === 'peer-joined',
    `Browser did not join the room: ${browserErrors.slice(-1000)}`,
  );
  const guestId = joined.peer.id;
  host.send(JSON.stringify({ type: 'approve-peer', peerId: guestId, slot: 0 }));

  const initialOffer = await next(
    message => message.type === 'offer' && message.fromPeerId === guestId,
    'Browser did not create its initial WebRTC offer.',
  );
  assertOffer(initialOffer, 'fake-1', false);
  host.send(JSON.stringify({
    type: 'answer',
    targetPeerId: guestId,
    sdp: { type: 'answer', sdp: 'v=0\r\na=ice-ufrag:host-initial\r\n' },
  }));

  for (let attempt = 0; attempt < 40; attempt++) {
    const stable = await cdp.evaluate(`window.__parsageTestPeerConnections?.[0]?.signalingState === 'stable'`);
    if (stable) break;
    if (attempt === 39) throw new Error('Initial browser peer connection did not reach stable signaling state.');
    await delay(50);
  }
  const tokenBefore = await cdp.evaluate(`sessionStorage.getItem('parsage-reconnect-token')`);
  if (!tokenBefore) throw new Error('Browser did not persist its initial reconnect token.');

  await cdp.evaluate(`(() => {
    const socket = window.__parsageTestSockets.at(-1);
    if (!socket) throw new Error('Tracked signaling socket was unavailable.');
    socket.close(4000, 'forced reconnect test');
    return true;
  })()`);

  const restartOffer = await next(
    message => message.type === 'offer'
      && message.fromPeerId === guestId
      && message.sdp?.sdp?.includes('fake-2'),
    'Browser did not send an authorized ICE-restart offer after session resumption.',
  );
  assertOffer(restartOffer, 'fake-2', true);
  host.send(JSON.stringify({
    type: 'answer',
    targetPeerId: guestId,
    sdp: { type: 'answer', sdp: 'v=0\r\na=ice-ufrag:host-restart\r\n' },
  }));

  const recovery = await cdp.evaluate(`(() => {
    const pc = window.__parsageTestPeerConnections[0];
    return {
      socketCount: window.__parsageTestSockets.length,
      restartIceCalls: pc?.restartIceCalls ?? 0,
      offerOptions: pc?.offerOptions ?? [],
      signalingState: pc?.signalingState ?? null,
      token: sessionStorage.getItem('parsage-reconnect-token'),
    };
  })()`);
  if (recovery.socketCount < 2) throw new Error(`Expected a replacement signaling socket: ${JSON.stringify(recovery)}`);
  if (recovery.restartIceCalls < 1) throw new Error(`ICE restart was not invoked: ${JSON.stringify(recovery)}`);
  if (!recovery.offerOptions.some(options => options.iceRestart === true)) {
    throw new Error(`Restart offer did not request fresh ICE credentials: ${JSON.stringify(recovery)}`);
  }
  if (recovery.token === tokenBefore) throw new Error('Reconnect token was not rotated after session resumption.');

  console.log(JSON.stringify({
    recovered: true,
    roomCode: room.roomCode,
    guestPeerId: guestId,
    signalingSockets: recovery.socketCount,
    reconnectTokenRotated: recovery.token !== tokenBefore,
    restartIceCalls: recovery.restartIceCalls,
    restartOfferUsedIceRestart: true,
  }, null, 2));
} finally {
  cleanup();
}

function assertOffer(message, expectedUfrag, expectedRestart) {
  if (!message.sdp?.sdp?.includes(`a=ice-ufrag:${expectedUfrag}`)) {
    throw new Error(`Unexpected browser offer: ${JSON.stringify(message)}`);
  }
  if (expectedRestart && expectedUfrag === 'fake-1') {
    throw new Error('Initial offer was incorrectly treated as an ICE restart.');
  }
}
