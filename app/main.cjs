const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let serverProcess = null;
let uinputProcess = null;
const PORT = 7777;

const ROOT_DIR = path.resolve(__dirname, '..');

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
      contextIsolation: true
    }
  });

  waitForServer(() => {
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
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
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
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
