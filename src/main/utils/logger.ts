import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

// Diretório de logs
const LOGS_DIR = path.join(app.getPath('userData'), 'logs');

// Garantir que o diretório de logs exista
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Configuração de rotação de logs (5 MB por arquivo, máximo 5 arquivos)
const LOG_ROTATION_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5 MB
  maxFiles: 5,
  tailable: true,
};

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    return stack ? `${logMessage}\n${stack}` : logMessage;
  })
);

// Logger principal
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    // Log para arquivo com rotação
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

// Adicionar log para console em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    })
  );
}

// Funções utilitárias de log
export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: any) => {
  if (error instanceof Error) {
    logger.error(`${message}: ${error.message}`, { stack: error.stack });
  } else {
    logger.error(message, error);
  }
};

export const logWarning = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

// Função para setup do sistema de logs
export const setupLogging = () => {
  logInfo('Sistema de logs inicializado', {
    logsDir: LOGS_DIR,
    nodeEnv: process.env.NODE_ENV,
    appVersion: app.getVersion(),
  });

  // Capturar erros não tratados
  process.on('uncaughtException', error => {
    logError('Erro não tratado', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logError('Promise rejeitada não tratada', { reason, promise });
  });
};

// Função para obter logs recentes (útil para debug)
export const getRecentLogs = (lines: number = 100): string[] => {
  try {
    const logFile = path.join(LOGS_DIR, 'combined.log');
    if (!fs.existsSync(logFile)) {
      return ['Arquivo de log não encontrado'];
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    const logLines = content.split('\n').filter(line => line.trim());
    return logLines.slice(-lines);
  } catch (error) {
    logError('Erro ao ler logs', error);
    return [`Erro ao ler logs: ${error}`];
  }
};

// Limpar logs antigos (mantém apenas últimos 6 meses)
export const cleanupOldLogs = () => {
  try {
    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000; // 6 meses em milissegundos

    files.forEach(file => {
      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < sixMonthsAgo) {
        fs.unlinkSync(filePath);
        logInfo(`Log antigo removido: ${file}`);
      }
    });
  } catch (error) {
    logError('Erro ao limpar logs antigos', error);
  }
};

// Exportar interface para TypeScript
export interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, error?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}
