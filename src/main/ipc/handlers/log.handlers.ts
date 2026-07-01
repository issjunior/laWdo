import { ipcMain } from 'electron';
import { getAllLogs, clearAllLogs, logInfo, logError } from '../../utils/logger.js';
import {
  listAuditLogs,
  clearAuditLogs,
  countAuditLogs,
  getTimelineRep,
  auditLimpezaLogs,
} from '../../services/audit-log.service.js';
import type { AuditFilters } from '../../services/audit-log.service.js';

export const registerLogSystemHandlers = (): void => {
  logInfo('Registrando handlers de logs do sistema...');

  ipcMain.handle('log:listar', async (_event, filters?: Record<string, unknown>) => {
    try {
      const logs = getAllLogs();
      let filtered = logs;

      if (filters) {
        if (filters.module && typeof filters.module === 'string') {
          filtered = filtered.filter(l => l.module === filters.module);
        }
        if (filters.level && typeof filters.level === 'string') {
          filtered = filtered.filter(l => l.level === filters.level);
        }
        if (filters.startDate && typeof filters.startDate === 'string') {
          filtered = filtered.filter(l => l.timestamp >= filters.startDate!);
        }
        if (filters.endDate && typeof filters.endDate === 'string') {
          filtered = filtered.filter(l => l.timestamp <= filters.endDate!);
        }
        if (filters.search && typeof filters.search === 'string') {
          const s = (filters.search as string).toLowerCase();
          filtered = filtered.filter(
            l => l.message.toLowerCase().includes(s),
          );
        }
      }

      return { success: true, data: filtered };
    } catch (error) {
      logError('Erro ao listar logs do sistema', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('log:limpar', async () => {
    try {
      const result = clearAllLogs();
      return result;
    } catch (error) {
      logError('Erro ao limpar logs do sistema', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('log:listar-auditoria', async (_event, filters?: AuditFilters) => {
    try {
      const result = await listAuditLogs(filters);
      return { success: true, data: result.data, total: result.total };
    } catch (error) {
      logError('Erro ao listar auditoria', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('log:timeline-rep', async (_event, repId: string) => {
    try {
      const result = await getTimelineRep(repId);
      return result;
    } catch (error) {
      logError('Erro ao buscar timeline da REP', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('log:limpar-auditoria', async (_event, userId?: string) => {
    try {
      const result = await clearAuditLogs();
      if (userId) {
        auditLimpezaLogs(userId);
      }
      return result;
    } catch (error) {
      logError('Erro ao limpar auditoria', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('log:contar', async () => {
    try {
      const sistema = getAllLogs().length;
      const auditoria = await countAuditLogs();
      return { success: true, data: { sistema, auditoria } };
    } catch (error) {
      logError('Erro ao contar logs', error);
      return { success: false, error: String(error), data: { sistema: 0, auditoria: 0 } };
    }
  });

  logInfo('Handlers de logs do sistema registrados');
};
