const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

let mainWindow = null;
let serverProcess = null;
let uinputProcess = null;
const PORT = 7777;
const INPUT_PORT = 7778;

const ROOT_DIR = path.resolve(__dirname, '..');
let inputSocket = null;

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
  inputSocket.on('error', (err) => {
    console.error('[Parsage App] Input bridge unavailable:', err.message);
    inputSocket = null;
  });
  inputSocket.on('close', () => { inputSocket = null; });
}

// Spawn background services (uinput & server)
function startBackgroundServices() {
  console.log('[Parsage App] Starting uinput service...');
  const uinputScript = path.join(ROOT_DIR, 'host', 'uinput_service.py');
  uinputProcess = spawn('python3', [uinputScript], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  uinputProcess.on('error', (err) => {
    console.error('[Parsage App] Failed to start uinput service:', err);
  });

  console.log('[Parsage App] Starting signaling & web server...');
  const serverScript = path.join(ROOT_DIR, 'server', 'dist', 'index.js');
  serverProcess = spawn('node', [serverScript], {
    cwd: path.join(ROOT_DIR, 'server'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('[Parsage App] Failed to start server:', err);
  });
}

function stopBackgroundServices() {
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
      if (event.senderFrame.url.startsWith(`http://127.0.0.1:${PORT}/`)) sendInputPacket(packet);
    });
    ipcMain.handle('open-external', async (event, url) => {
      if (!event.senderFrame.url.startsWith(`http://127.0.0.1:${PORT}/`)) return false;
      if (typeof url !== 'string' || !url.startsWith(`http://127.0.0.1:${PORT}/?authPair=`)) return false;
      await shell.openExternal(url);
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
