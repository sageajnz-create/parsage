import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface CrashMarker {
  at: string;
  service: string;
  message: string;
  code?: number | null;
}

export function defaultCrashPath(): string {
  if (process.env.PARSAGE_CRASH_PATH) return process.env.PARSAGE_CRASH_PATH;
  const stateHome = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(stateHome, 'parsage', 'last-crash.json');
}

export function writeCrashMarker(marker: Omit<CrashMarker, 'at'> & { at?: string }, filePath = defaultCrashPath()): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const payload: CrashMarker = {
    at: marker.at || new Date().toISOString(),
    service: marker.service,
    message: String(marker.message).slice(0, 500),
    code: marker.code ?? null
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function readCrashMarker(filePath = defaultCrashPath()): CrashMarker | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CrashMarker;
    if (!parsed?.service || !parsed?.message || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCrashMarker(filePath = defaultCrashPath()): void {
  try { fs.unlinkSync(filePath); } catch { /* already gone */ }
}

export function installProcessCrashHandler(service = 'signaling'): void {
  const report = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    try { writeCrashMarker({ service, message }); } catch { /* last resort */ }
  };
  process.on('uncaughtException', error => {
    report(error);
    process.exit(1);
  });
  process.on('unhandledRejection', reason => {
    report(reason);
  });
}
