#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { WebSocket } from '../server/node_modules/ws/wrapper.mjs';

const root = resolve(import.meta.dirname, '..');
const port = 17781;
const debuggingPort = 19225;
const profile = mkdtempSync(join(tmpdir(), 'parsage-a11y-'));
const children = [];
let debug;

function browserExecutable() {
  const configured = process.env.BROWSER_BIN || process.env.CHROME_BIN;
  const candidates = process.platform === 'win32'
    ? [
        configured,
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
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
  for (const process of children) {
    try { process.kill('SIGTERM'); } catch {}
  }
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

try {
  const server = child(process.execPath, ['server/dist/index.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      PARSAGE_STORE_PATH: join(tmpdir(), `parsage-a11y-store-${port}.json`),
      PARSAGE_CRASH_PATH: join(tmpdir(), `parsage-a11y-crash-${port}.json`),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverErrors = '';
  server.stderr.on('data', chunk => { serverErrors += chunk.toString(); });
  await waitForHttp(`http://127.0.0.1:${port}/api/status`).catch(error => {
    throw new Error(`${error.message}: ${serverErrors}`);
  });

  const browser = child(browserExecutable(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profile}`,
    `http://127.0.0.1:${port}/`,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let browserErrors = '';
  browser.stderr.on('data', chunk => { browserErrors += chunk.toString(); });

  let page;
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debuggingPort}/json`).then(r => r.json());
      page = pages.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
      if (page) break;
    } catch {}
    await delay(100);
  }
  if (!page) throw new Error(`No Chromium debugging page found: ${browserErrors.slice(-2000)}`);

  debug = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    debug.once('open', resolveOpen);
    debug.once('error', rejectOpen);
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 8000);
    const onMessage = raw => {
      const message = JSON.parse(raw.toString());
      if (message.id !== id) return;
      debug.off('message', onMessage);
      clearTimeout(timer);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
    debug.on('message', onMessage);
    debug.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  for (let attempt = 0; attempt < 50; attempt++) {
    const ready = await send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('nav[aria-label="Main"]') && document.getElementById('parsage-main'))`,
      returnByValue: true,
    });
    if (ready.result.value) break;
    if (attempt === 49) throw new Error('Parsage shell did not render landmarks.');
    await delay(100);
  }

  const report = await send('Runtime.evaluate', {
    expression: `(() => {
      const nameOf = (el) => {
        const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
        if (el.getAttribute('aria-labelledby')) {
          return (el.getAttribute('aria-labelledby') || '').split(/\\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
        }
        return (el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('alt') || '').trim();
      };
      const unlabeledButtons = [...document.querySelectorAll('button')].filter(button => !nameOf(button)).map(button => button.outerHTML.slice(0, 160));
      const unlabeledInputs = [...document.querySelectorAll('input:not([type="hidden"])')].filter(input => {
        if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) return false;
        if (input.id && document.querySelector('label[for="' + input.id + '"]')) return false;
        if (input.closest('label')) return false;
        return true;
      }).map(input => input.outerHTML.slice(0, 160));
      return {
        lang: document.documentElement.lang,
        title: document.title,
        hasMain: Boolean(document.getElementById('parsage-main')),
        hasNav: Boolean(document.querySelector('nav[aria-label="Main"]')),
        hasSkipLink: Boolean(document.querySelector('a.skip-link[href="#parsage-main"]')),
        unlabeledButtons,
        unlabeledInputs,
      };
    })()`,
    returnByValue: true,
  });

  const result = report.result.value;
  const failures = [];
  if (result.lang !== 'en') failures.push(`html lang was "${result.lang}"`);
  if (!result.hasMain) failures.push('missing main landmark');
  if (!result.hasNav) failures.push('missing labeled navigation');
  if (!result.hasSkipLink) failures.push('missing skip link');
  if (result.unlabeledButtons.length) failures.push(`unlabeled buttons: ${result.unlabeledButtons.join(' | ')}`);
  if (result.unlabeledInputs.length) failures.push(`unlabeled inputs: ${result.unlabeledInputs.join(' | ')}`);
  if (failures.length) throw new Error(failures.join('; '));
  console.log(JSON.stringify({ accessibility: 'pass', ...result }, null, 2));
} finally {
  cleanup();
}
