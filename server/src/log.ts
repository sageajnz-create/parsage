const SECRET_KEY = /credential|token|cookie|secret|password|authorization|session/i;
const MAX_BUFFER = 500;

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEvent {
  ts: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
  recent(): LogEvent[];
}

function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEY.test(key)) return '[redacted]';
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return redact(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) return value.map((item, index) => redactValue(String(index), item));
  return value;
}

export function redact(fields: Record<string, unknown> = {}): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    clean[key] = redactValue(key, value);
  }
  return clean;
}

export function createLogger(options: { writer?: (line: string) => void; now?: () => Date } = {}): Logger {
  const buffer: LogEvent[] = [];
  const writer = options.writer ?? ((line: string) => process.stderr.write(`${line}\n`));
  const now = options.now ?? (() => new Date());

  const write = (level: LogLevel, event: string, fields: Record<string, unknown> = {}) => {
    const record: LogEvent = {
      ts: now().toISOString(),
      level,
      event,
      ...redact(fields)
    };
    buffer.push(record);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    writer(JSON.stringify(record));
  };

  return {
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
    recent: () => buffer.slice()
  };
}

export const log = createLogger();
