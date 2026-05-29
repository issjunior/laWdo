import { getLogger, type LogModule, type ILogger } from '../utils/logger.js';

const cache = new Map<LogModule, ILogger>();

export function createLogger(module: LogModule): ILogger {
  if (!cache.has(module)) {
    cache.set(module, getLogger(module));
  }
  return cache.get(module)!;
}
