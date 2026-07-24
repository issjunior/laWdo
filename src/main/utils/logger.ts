import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { registrarErroFatalMainDiagnostico } from '../services/diagnostico-state.service.js';

const LOGS_DIR = path.join(app.getPath('userData'), 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const LOG_ROTATION_CONFIG = {
  maxSize: 5 * 1024 * 1024,
  maxFiles: 5,
};

export type LogModule =
  | 'database' | 'auth' | 'laudo' | 'template' | 'rep'
  | 'solicitante' | 'tipo_exame' | 'placeholder' | 'backup'
  | 'configuracao' | 'ia' | 'ilustracao' | 'renderer' | 'sistema'
  | 'ipc' | 'security' | 'wizard' | 'peca' | 'regra-wizard'
  | 'gdl' | 'exportacao' | 'secao-builder' | 'atualizacao';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_LEVELS: Partial<Record<LogModule, LogLevel>> = {
  database: 'warn',
  auth: 'warn',
  renderer: 'warn',
  ilustracao: 'warn',
  ia: 'debug',
  sistema: 'warn',
  rep: 'warn',
  laudo: 'warn',
  template: 'warn',
  solicitante: 'warn',
  tipo_exame: 'warn',
  placeholder: 'warn',
  backup: 'info',
  configuracao: 'info',
  ipc: 'warn',
  security: 'warn',
  wizard: 'warn',
  peca: 'warn',
  'regra-wizard': 'warn',
  gdl: 'warn',
  exportacao: 'warn',
  atualizacao: 'info',
};

const moduleLogLevels: Partial<Record<LogModule, LogLevel>> = { ...DEFAULT_LEVELS };

function shouldLog(module: LogModule, level: LogLevel): boolean {
  const configured = moduleLogLevels[module] ?? 'warn';
  return LEVEL_RANK[level] >= LEVEL_RANK[configured];
}

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'DD/MM/YY HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'DD/MM/YY HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, module, message, duration, ...rest }) => {
    const parts: string[] = [`[${timestamp}]`, level];
    if (module) parts.push(`[${module as string}]`);
    parts.push(`: ${message as string}`);
    if (duration !== undefined) parts.push(` (${duration}ms)`);
    const restKeys = Object.keys(rest).filter(k => k !== 'timestamp' && k !== 'level' && k !== 'message' && k !== 'module' && k !== 'duration' && k !== 'stack');
    if (restKeys.length > 0) {
      parts.push(' ' + JSON.stringify(Object.fromEntries(restKeys.map(k => [k, rest[k]]))));
    }
    return parts.join('');
  }),
);

const baseLogger = winston.createLogger({
  level: 'debug',
  format: fileFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: LOG_ROTATION_CONFIG.maxSize,
      maxFiles: LOG_ROTATION_CONFIG.maxFiles,
    }),
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'combined.log'),
      maxsize: LOG_ROTATION_CONFIG.maxSize,
      maxFiles: LOG_ROTATION_CONFIG.maxFiles,
    }),
  ],
});

if (process.env.NODE_ENV === 'development') {
  baseLogger.add(
    new winston.transports.Console({ format: consoleFormat }),
  );
}

export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, errorOrMeta?: unknown): void;
  debug(message: string | (() => string), meta?: Record<string, unknown>): void;
}

class ModuleLogger implements ILogger {
  constructor(private module: LogModule) {}

  info(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(this.module, 'info')) return;
    baseLogger.info(message, { module: this.module, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(this.module, 'warn')) return;
    baseLogger.warn(message, { module: this.module, ...meta });
  }

  error(message: string, errorOrMeta?: unknown): void {
    if (!shouldLog(this.module, 'error')) return;
    if (errorOrMeta instanceof Error) {
      baseLogger.error(message, {
        module: this.module,
        error: { message: errorOrMeta.message, stack: errorOrMeta.stack },
      });
    } else if (errorOrMeta && typeof errorOrMeta === 'object') {
      baseLogger.error(message, { module: this.module, ...(errorOrMeta as Record<string, unknown>) });
    } else if (errorOrMeta !== undefined && errorOrMeta !== null) {
      baseLogger.error(message, { module: this.module, detail: String(errorOrMeta) });
    } else {
      baseLogger.error(message, { module: this.module });
    }
  }

  debug(message: string | (() => string), meta?: Record<string, unknown>): void {
    if (!shouldLog(this.module, 'debug')) return;
    const msg = typeof message === 'function' ? message() : message;
    baseLogger.debug(msg, { module: this.module, ...meta });
  }
}

const loggerCache = new Map<LogModule, ILogger>();

export function getLogger(module: LogModule): ILogger {
  if (!loggerCache.has(module)) {
    loggerCache.set(module, new ModuleLogger(module));
  }
  return loggerCache.get(module)!;
}

export const logInfo = (message: string, meta?: Record<string, unknown>) => {
  baseLogger.info(message, { module: 'sistema', ...meta });
};

export const logError = (message: string, error?: unknown) => {
  if (error instanceof Error) {
    baseLogger.error(message, {
      module: 'sistema',
      error: { message: error.message, stack: error.stack },
    });
  } else if (error && typeof error === 'object') {
    baseLogger.error(message, { module: 'sistema', ...(error as Record<string, unknown>) });
  } else if (error !== undefined && error !== null) {
    baseLogger.error(message, { module: 'sistema', detail: String(error) });
  } else {
    baseLogger.error(message, { module: 'sistema' });
  }
};

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
  baseLogger.debug(message, { module: 'sistema', ...meta });
};

export const setupLogging = () => {
  logDebug('Sistema de logs inicializado', {
    logsDir: LOGS_DIR,
    nodeEnv: process.env.NODE_ENV,
    appVersion: app.getVersion(),
  });

  process.on('uncaughtException', error => {
    const snapshotPath = registrarErroFatalMainDiagnostico(error, 'uncaughtException');
    baseLogger.error('Erro não tratado', {
      module: 'sistema',
      error: { message: error.message, stack: error.stack },
      snapshotPath,
    });
  });

  process.on('unhandledRejection', (reason) => {
    const snapshotPath = registrarErroFatalMainDiagnostico(reason, 'unhandledRejection');
    baseLogger.error('Promise rejeitada não tratada', {
      module: 'sistema',
      reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason),
      snapshotPath,
    });
  });
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: LogModule;
  message: string;
  error?: { message: string; stack?: string };
  duration?: number;
  [key: string]: unknown;
}

function parseJsonLogLine(line: string): LogEntry | null {
  try {
    const parsed = JSON.parse(line) as LogEntry;
    if (!parsed.timestamp || !parsed.level || !parsed.message) return null;
    if (!parsed.module) parsed.module = 'sistema';
    return parsed;
  } catch {
    return null;
  }
}

function parseLegacyLogLine(line: string): LogEntry | null {
  const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s+(\w+):\s+(.*)$/);
  if (!match) return null;
  const [, timestamp, level, message] = match;
  const validLevels = ['error', 'warn', 'info', 'debug'];
  return {
    timestamp,
    level: validLevels.includes(level.toLowerCase()) ? level.toLowerCase() as LogLevel : 'info',
    module: 'sistema',
    message,
  };
}

export const getAllLogs = (): LogEntry[] => {
  try {
    const entries: LogEntry[] = [];
    const files = fs.readdirSync(LOGS_DIR).filter(f => /^combined\.log(\.\d+)?$/.test(f));

    for (const file of files) {
      const filepath = path.join(LOGS_DIR, file);
      const content = fs.readFileSync(filepath, 'utf-8');
      const lines = content.split('\n');

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const jsonEntry = parseJsonLogLine(line);
        if (jsonEntry) {
          entries.push(jsonEntry);
          continue;
        }

        const legacyEntry = parseLegacyLogLine(line);
        if (legacyEntry) {
          entries.push(legacyEntry);
        }
      }
    }

    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries;
  } catch (err) {
    logError('Erro ao ler logs do sistema', err);
    return [];
  }
};

export const clearAllLogs = (): { success: boolean; error?: string } => {
  try {
    const files = fs.readdirSync(LOGS_DIR).filter(f => /^(combined|error)\.log(\.\d+)?$/.test(f));
    for (const file of files) {
      fs.writeFileSync(path.join(LOGS_DIR, file), '', 'utf-8');
    }
    logDebug('Logs do sistema limpos pelo usuário');
    return { success: true };
  } catch (err) {
    logError('Erro ao limpar logs do sistema', err);
    return { success: false, error: String(err) };
  }
};
