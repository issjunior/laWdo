import { ipcMain } from 'electron';
import { logInfo, logError } from '../../utils/logger.js';
import { placeholderService } from '../../services/placeholder.service.js';
import { sanitizeInput } from '../../security/index.js';

export const registerPlaceholderHandlers = (): void => {
  logInfo('Registrando handlers de placeholder...');

  ipcMain.handle('placeholder:findAll', async () => {
    try {
      const rows = await placeholderService.findAll();
      return { success: true, data: rows };
    } catch (error) {
      logError('Erro ao buscar placeholders', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('placeholder:findById', async (_event, id: string) => {
    try {
      if (!id || typeof id !== 'string') return { success: false, error: 'ID inválido' };
      const row = await placeholderService.findById(id);
      if (!row) return { success: false, error: 'Placeholder não encontrado' };
      return { success: true, data: row };
    } catch (error) {
      logError('Erro ao buscar placeholder', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('placeholder:create', async (_event, data) => {
    try {
      if (!data.chave || typeof data.chave !== 'string' || !data.chave.trim()) {
        return { success: false, error: 'Chave do placeholder é obrigatória.' };
      }
      const createData = {
        chave: sanitizeInput(data.chave.trim()),
        valor: data.valor ? sanitizeInput(data.valor) : '',
        descricao: data.descricao ? sanitizeInput(data.descricao) : null,
        categoria_id: data.categoria_id ? sanitizeInput(data.categoria_id) : null,
      };
      const row = await placeholderService.create(createData);
      return { success: true, data: row, message: 'Placeholder criado com sucesso' };
    } catch (error) {
      logError('Erro ao criar placeholder', { data, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('placeholder:update', async (_event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string') return { success: false, error: 'ID inválido' };
      const updateData: Record<string, any> = {};
      if (data.chave !== undefined) updateData.chave = sanitizeInput(data.chave);
      if (data.valor !== undefined) updateData.valor = sanitizeInput(data.valor);
      if (data.descricao !== undefined) updateData.descricao = data.descricao ? sanitizeInput(data.descricao) : null;
      if (data.categoria_id !== undefined) updateData.categoria_id = data.categoria_id ? sanitizeInput(data.categoria_id) : null;

      const row = await placeholderService.update(id, updateData);
      if (!row) return { success: false, error: 'Placeholder não encontrado' };
      return { success: true, data: row, message: 'Placeholder atualizado com sucesso' };
    } catch (error) {
      logError('Erro ao atualizar placeholder', { id, data, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('placeholder:delete', async (_event, id: string) => {
    try {
      if (!id || typeof id !== 'string') return { success: false, error: 'ID inválido' };
      await placeholderService.delete(id);
      return { success: true, message: 'Placeholder excluído com sucesso' };
    } catch (error) {
      logError('Erro ao excluir placeholder', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('placeholder:migrateSistema', async () => {
    try {
      const result = await placeholderService.migrateSistema();
      return { success: true, data: result, message: 'Migração de placeholders concluída' };
    } catch (error) {
      logError('Erro ao migrar placeholders do sistema', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('placeholder:seedSistema', async () => {
    try {
      await placeholderService.seedSistema();
      return { success: true, message: 'Placeholders do sistema semeados com sucesso' };
    } catch (error) {
      logError('Erro ao semear placeholders do sistema', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  logInfo('Handlers de placeholder registrados com sucesso');
};
