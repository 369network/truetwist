import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  correlationId?: string;
  service: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function emit(entry: LogEntry) {
  const output = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(output);
  } else if (entry.level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export function createLogger(service: string, correlationId?: string) {
  const cid = correlationId || randomUUID();

  function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!shouldLog(level)) return;
    emit({
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: cid,
      service,
      ...meta,
    });
  }

  return {
    correlationId: cid,
    debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
    child: (childService: string) => createLogger(`${service}.${childService}`, cid),
  };
}

/** Extract or generate a correlation ID from request headers */
export function getCorrelationId(headers: Headers): string {
  return (
    headers.get('x-correlation-id') ||
    headers.get('x-request-id') ||
    randomUUID()
  );
}
