import assert from 'node:assert/strict';
import test from 'node:test';
import { createLogger, redact } from './log.js';
import { isNewerVersion, checkForUpdate } from './updates.js';
import { buildSupportBundle } from './support-bundle.js';
import { AccountRegistry } from './account.js';
import { DurableStore } from './store.js';
import { clearCrashMarker, readCrashMarker, writeCrashMarker } from './crash.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('structured logs redact secrets and keep a ring buffer', () => {
  const lines: string[] = [];
  const logger = createLogger({
    writer: line => lines.push(line),
    now: () => new Date('2026-09-01T00:00:00.000Z')
  });
  logger.info('login_rejected', { token: 'super-secret', reason: 'expired' });
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, 'login_rejected');
  assert.equal(parsed.token, '[redacted]');
  assert.equal(parsed.reason, 'expired');
  assert.equal(redact({ TURN_CREDENTIAL: 'abc', ok: true }).TURN_CREDENTIAL, '[redacted]');
});

test('update check compares versions without sending extra client data', async () => {
  assert.equal(isNewerVersion('0.3.0', '0.2.0'), true);
  assert.equal(isNewerVersion('0.2.0', '0.2.0'), false);
  const status = await checkForUpdate({
    current: '0.2.0',
    fetchRelease: async () => ({ tag_name: 'v0.3.1', html_url: 'https://example.com/release' })
  });
  assert.equal(status.updateAvailable, true);
  assert.equal(status.latest, '0.3.1');
  assert.equal(status.source, 'github');
});

test('support bundle omits secrets and includes crash plus log events', () => {
  const crashFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'parsage-crash-')), 'last-crash.json');
  process.env.PARSAGE_CRASH_PATH = crashFile;
  writeCrashMarker({ service: 'signaling', message: 'child exited', code: 1 }, crashFile);
  const bundle = buildSupportBundle({
    accounts: new AccountRegistry(DurableStore.memory()),
    logs: [{ ts: '2026-09-01T00:00:00.000Z', level: 'info', event: 'room_created', token: 'nope' }],
    uptime: 12,
    now: () => 1_700_000_000_000
  });
  assert.equal(bundle.version, '0.2.0');
  assert.deepEqual(bundle.crash, readCrashMarker(crashFile));
  assert.equal((bundle.logs as any)[0].event, 'room_created');
  clearCrashMarker(crashFile);
  delete process.env.PARSAGE_CRASH_PATH;
});
