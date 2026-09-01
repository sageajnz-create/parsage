import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP_NAME, APP_VERSION } from './version.js';
import { AccountRegistry } from './account.js';
import { LogEvent, redact } from './log.js';
import { readCrashMarker } from './crash.js';

export function defaultStateDir(): string {
  if (process.env.PARSAGE_STATE_DIR) return process.env.PARSAGE_STATE_DIR;
  const stateHome = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(stateHome, 'parsage');
}

export function buildSupportBundle(options: {
  accounts: AccountRegistry;
  logs: LogEvent[];
  uptime: number;
  now?: () => number;
}): Record<string, unknown> {
  const now = options.now ?? Date.now;
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID);
  const turnConfigured = Boolean(process.env.TURN_URLS);
  return redact({
    app: APP_NAME,
    version: APP_VERSION,
    createdAt: new Date(now()).toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    uptimeSeconds: Math.round(options.uptime),
    hostname: os.hostname(),
    configPresent: {
      googleClientId: googleConfigured,
      requireAuth: process.env.REQUIRE_AUTH === 'true',
      cookieSecure: process.env.COOKIE_SECURE === 'true',
      turnUrls: turnConfigured,
      storePath: Boolean(process.env.PARSAGE_STORE_PATH)
    },
    storeCounts: options.accounts.counts(),
    crash: readCrashMarker(),
    logs: options.logs
  });
}

export function writeSupportBundle(bundle: Record<string, unknown>, destination?: string): string {
  const dir = destination ? path.dirname(destination) : defaultStateDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = destination || path.join(dir, `parsage-support-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(bundle, null, 2), { encoding: 'utf8', mode: 0o600 });
  return file;
}
