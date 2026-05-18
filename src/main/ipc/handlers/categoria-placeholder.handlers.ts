import { ipcMain } from 'electron';
import { logInfo, logError } from '../../utils/logger.js';
import { categoriaService } from '../../services/categoria-placeholder.service.js';
import { sanitizeInput } from '../../security/index.js';

// Cores permitidas do Tailwind
const ALLOWED_COLORS = ['slate', 'red', 'orange', 'amber', 'emerald', 'teal', 'blue', 'indigo', 'violet', 'fuchsia', 'pink', 'rose'];

export const registerCategoriaHandlers = (): void => {
  logInfo('Registrando handlers de categoria de placeholder...');

  ipcMain.handle('categoria:findAll', async () => {
    try {
      const rows = await categoriaService.findAll();
      // Retorna ordenado pela coluna "ordem"
      const sortedRows = rows.sort((a, b) => a.ordem - b.ordem);
      return { success: true, data: sortedRows };
    } catch (error) {
      logError('Erro ao buscar categorias', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('categoria:create', async (_event, data) => {
    try {
      if (!data.chave || typeof data.chave !== 'string' || !data.chave.trim()) {
        return { success: false, error: 'Chave da categoria é obrigatória.' };
      }
      if (!data.label || typeof data.label !== 'string' || !data.label.trim()) {
        return { success: false, error: 'Label da categoria é obrigatório.' };
      }

      const cor = data.cor && ALLOWED_COLORS.includes(data.cor) ? data.cor : 'slate';

      const createData = {
        chave: sanitizeInput(data.chave.trim()),
        label: sanitizeInput(data.label.trim()),
        descricao: data.descricao ? sanitizeInput(data.descricao) : null,
        cor: sanitizeInput(cor),
        icone: data.icone ? sanitizeInput(data.icone) : 'Tag',
        is_sistema: 0,
        ordem: typeof data.ordem === 'number' ? data.ordem : 99,
      };

      const row = await categoriaService.create(createData);
      return { success: true, data: row, message: 'Categoria criada com sucesso' };
    } catch (error) {
      logError('Erro ao criar categoria', { data, error });
      // Verifica erro de unique constraint
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Já existe uma categoria com esta chave ou label.' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('categoria:update', async (_event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string') return { success: false, error: 'ID inválido' };
      
      const updateData: Record<string, any> = {};
      
      if (data.chave !== undefined) updateData.chave = sanitizeInput(data.chave);
      if (data.label !== undefined) updateData.label = sanitizeInput(data.label);
      if (data.descricao !== undefined) updateData.descricao = data.descricao ? sanitizeInput(data.descricao) : null;
      if (data.cor !== undefined) {
        updateData.cor = ALLOWED_COLORS.includes(data.cor) ? sanitizeInput(data.cor) : 'slate';
      }
      if (data.icone !== undefined) updateData.icone = data.icone ? sanitizeInput(data.icone) : 'Tag';
      if (data.ordem !== undefined && typeof data.ordem === 'number') updateData.ordem = data.ordem;

      const row = await categoriaService.update(id, updateData);
      if (!row) return { success: false, error: 'Categoria não encontrada' };
      
      return { success: true, data: row, message: 'Categoria atualizada com sucesso' };
    } catch (error) {
      logError('Erro ao atualizar categoria', { id, data, error });
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Já existe uma categoria com esta chave ou label.' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('categoria:delete', async (_event, id: string) => {
    try {
      if (!id || typeof id !== 'string') return { success: false, error: 'ID inválido' };
      await categoriaService.delete(id);
      return { success: true, message: 'Categoria excluída com sucesso' };
    } catch (error) {
      logError('Erro ao excluir categoria', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  logInfo('Handlers de categoria de placeholder registrados com sucesso');
};
