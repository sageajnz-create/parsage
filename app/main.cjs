const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const readline = require('readline');

let mainWindow = null;
let serverProcess = null;
let uinputProcess = null;
const PORT = 7777;
const INPUT_PORT = 7778;
let stopping = false;
let restartAttempts = [];

const ROOT_DIR = path.resolve(__dirname, '..');
let inputSocket = null;
let nativePeerProcess = null;
let nativePeerOwner = null;

function getJoinCode(argv = process.argv) {
  const argument = argv.find((value) => value.startsWith('--join='));
  if (!argument) return null;
  const code = argument.slice('--join='.length).trim().toUpperCase();
  return /^PARSAGE-[A-Z0-9]+-([0-9]{3}|[A-Z2-9]{8})$/.test(code) ? code : null;
}

function sendInputPacket(packet) {
  if (!packet || typeof packet !== 'object') return;
  const payload = `${JSON.stringify(packet)}\n`;

  const write = () => {
    if (inputSocket && !inputSocket.destroyed) inputSocket.write(payload);
  };

  if (inputSocket && !inputSocket.destroyed) {
    write();
    return;
  }

  inputSocket = net.createConnection({ host: '127.0.0.1', port: INPUT_PORT }, write);
  attachInputReader(inputSocket);
  inputSocket.on('error', (err) => {
    console.error('[Parsage App] Input bridge unavailable:', err.message);
    inputSocket = null;
  });
  inputSocket.on('close', () => { inputSocket = null; });
}

function attachInputReader(socket) {
  const lines = readline.createInterface({ input: socket });
  lines.on('line', (line) => {
    try {
      const message = JSON.parse(line);
      if (message?.type === 'rumble' && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('input-rumble', message);
      }
    } catch (_error) {}
  });
}

function crashPath() {
  if (process.env.PARSAGE_CRASH_PATH) return process.env.PARSAGE_CRASH_PATH;
  const stateHome = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(stateHome, 'parsage', 'last-crash.json');
}

function writeCrashMarker(service, message, code) {
  try {
    const file = crashPath();
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify({
      at: new Date().toISOString(),
      service,
      message: String(message).slice(0, 500),
      code: code ?? null
    }, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (_error) {}
}

function canRestart() {
  const now = Date.now();
  restartAttempts = restartAttempts.filter(timestamp => now - timestamp < 60_000);
  if (restartAttempts.length >= 5) return false;
  restartAttempts.push(now);
  return true;
}

function watchChild(child, service) {
  if (!child) return;
  child.on('exit', (code, signal) => {
    if (stopping) return;
    writeCrashMarker(service, `${service} exited (${signal || code})`, code);
    if (!canRestart()) return;
    if (service === 'signaling') {
      startSignalingServer();
      if (mainWindow && !mainWindow.isDestroyed()) waitForServer(() => mainWindow.reload());
    } else if (service === 'uinput') {
      startUinputService();
    }
  });
}

function startUinputService() {
  const uinputScript = path.join(ROOT_DIR, 'host', 'uinput_service.py');
  uinputProcess = spawn('python3', [uinputScript], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });
  uinputProcess.on('error', (err) => {
    console.error('[Parsage App] Failed to start uinput service:', err);
  });
  watchChild(uinputProcess, 'uinput');
}

function startSignalingServer() {
  const serverScript = path.join(ROOT_DIR, 'server', 'dist', 'index.js');
  serverProcess = spawn('node', [serverScript], {
    cwd: path.join(ROOT_DIR, 'server'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit'
  });
  serverProcess.on('error', (err) => {
    console.error('[Parsage App] Failed to start server:', err);
  });
  watchChild(serverProcess, 'signaling');
}

function startBackgroundServices() {
  startUinputService();
  startSignalingServer();
}

function stopBackgroundServices() {
  stopping = true;
  console.log('[Parsage App] Stopping background services...');
  if (uinputProcess) {
    try { uinputProcess.kill('SIGTERM'); } catch (e) {}
    uinputProcess = null;
  }
  if (inputSocket) {
    inputSocket.destroy();
    inputSocket = null;
  }
  if (serverProcess) {
    try { serverProcess.kill('SIGTERM'); } catch (e) {}
    serverProcess = null;
  }
  stopNativePeer();
}

function stopNativePeer() {
  if (nativePeerProcess) {
    try { nativePeerProcess.stdin.write('{"type":"stop"}\n'); } catch (_error) {}
    try { nativePeerProcess.kill('SIGTERM'); } catch (_error) {}
    nativePeerProcess = null;
  }
  nativePeerOwner = null;
}

function isTrustedRenderer(event) {
  return event.senderFrame.url.startsWith(`http://127.0.0.1:${PORT}/`);
}

function waitForServer(callback, maxAttempts = 30) {
  let attempts = 0;
  const check = () => {
    attempts++;
    const req = http.get(`http://127.0.0.1:${PORT}/api/status`, (res) => {
      if (res.statusCode === 200) {
        callback();
      } else {
        if (attempts < maxAttempts) setTimeout(check, 100);
        else callback();
      }
    });
    req.on('error', () => {
      if (attempts < maxAttempts) setTimeout(check, 100);
      else callback();
    });
    req.end();
  };
  check();
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'Parsage',
    backgroundColor: '#1B1A17',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  waitForServer(() => {
    const joinCode = getJoinCode();
    const query = joinCode ? `?join=${encodeURIComponent(joinCode)}` : '';
    mainWindow.loadURL(`http://127.0.0.1:${PORT}/${query}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      const joinCode = getJoinCode(argv);
      if (joinCode) mainWindow.loadURL(`http://127.0.0.1:${PORT}/?join=${encodeURIComponent(joinCode)}`);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ipcMain.on('input-packet', (event, packet) => {
      if (isTrustedRenderer(event)) sendInputPacket(packet);
    });
    ipcMain.handle('open-external', async (event, url) => {
      if (!event.senderFrame.url.startsWith(`http://127.0.0.1:${PORT}/`)) return false;
      if (typeof url !== 'string' || !url.startsWith(`http://127.0.0.1:${PORT}/?authPair=`)) return false;
      await shell.openExternal(url);
      return true;
    });
    ipcMain.handle('native-peer-start', async (event, options = {}) => {
      if (!isTrustedRenderer(event)) return { ok: false, error: 'Untrusted renderer.' };
      const targetPeerId = typeof options.targetPeerId === 'string' ? options.targetPeerId : '';
      const fps = Number.isInteger(options.fps) && options.fps >= 15 && options.fps <= 240 ? options.fps : 60;
      const bitrate = Number.isInteger(options.bitrate) && options.bitrate >= 2 && options.bitrate <= 100 ? options.bitrate : 25;
      const allowedCodecs = new Set(['h264', 'hevc', 'av1']);
      const codecs = Array.isArray(options.codecs)
        ? options.codecs.filter((codec) => allowedCodecs.has(String(codec)))
        : ['h264'];
      const preference = allowedCodecs.has(options.preference) || options.preference === 'auto'
        ? options.preference
        : 'h264';
      if (!/^peer-[a-z0-9-]+$/.test(targetPeerId)) return { ok: false, error: 'Invalid target peer.' };
      stopNativePeer();
      const script = path.join(ROOT_DIR, 'host', 'native_pipeline.py');
      nativePeerOwner = targetPeerId;
      nativePeerProcess = spawn('python3', [
        script, 'webrtc-peer',
        '--fps', String(fps),
        '--bitrate', String(bitrate),
        '--remote-codecs', codecs.join(',') || 'h264',
        '--preference', preference
      ], {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const peerProcess = nativePeerProcess;
      const lines = readline.createInterface({ input: peerProcess.stdout });
      lines.on('line', (line) => {
        try {
          event.sender.send('native-peer-message', { targetPeerId, message: JSON.parse(line) });
        } catch (_error) {
          event.sender.send('native-peer-message', { targetPeerId, message: { type: 'error', message: 'Invalid native media response.' } });
        }
      });
      peerProcess.stderr.on('data', (chunk) => console.error('[Native Media]', chunk.toString().trim()));
      peerProcess.on('error', (error) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('native-peer-message', { targetPeerId, message: { type: 'error', message: error.message } });
        }
      });
      peerProcess.on('exit', (code) => {
        if (!event.sender.isDestroyed()) event.sender.send('native-peer-message', { targetPeerId, message: { type: 'stopped', code } });
        if (nativePeerProcess === peerProcess) {
          nativePeerProcess = null;
          nativePeerOwner = null;
        }
      });
      return { ok: true };
    });
    ipcMain.on('native-peer-signal', (event, payload) => {
      if (!isTrustedRenderer(event) || !nativePeerProcess || payload?.targetPeerId !== nativePeerOwner) return;
      try { nativePeerProcess.stdin.write(`${JSON.stringify(payload.message)}\n`); } catch (_error) {}
    });
    ipcMain.handle('native-peer-stop', (event) => {
      if (!isTrustedRenderer(event)) return false;
      stopNativePeer();
      return true;
    });
    startBackgroundServices();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    stopBackgroundServices();
    app.quit();
  });

  app.on('will-quit', () => {
    stopBackgroundServices();
  });

  process.on('SIGINT', () => {
    stopBackgroundServices();
    app.quit();
  });

  process.on('SIGTERM', () => {
    stopBackgroundServices();
    app.quit();
  });
}
