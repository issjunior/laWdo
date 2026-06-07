import { ipcMain } from 'electron';
import { logInfo, logError } from '../../utils/logger.js';
import { auditDelete } from '../../services/audit-log.service.js';
import { categoriaPecaService } from '../../services/categoria-peca.service.js';
import { sanitizeInput } from '../../security/index.js';

const ALLOWED_COLORS = ['slate', 'red', 'orange', 'amber', 'emerald', 'teal', 'blue', 'indigo', 'violet', 'fuchsia', 'pink', 'rose'];

export const registerCategoriaPecaHandlers = (): void => {
  logInfo('Registrando handlers de categoria de peça...');

  ipcMain.handle('categoria-peca:findAll', async () => {
    try {
      const rows = await categoriaPecaService.findAllOrdered();
      return { success: true, data: rows };
    } catch (error) {
      logError('Erro ao buscar categorias de peças', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('categoria-peca:findArvore', async () => {
    try {
      const arvore = await categoriaPecaService.findArvore();
      return { success: true, data: arvore };
    } catch (error) {
      logError('Erro ao buscar árvore de categorias', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('categoria-peca:create', async (_event, data) => {
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
        parent_id: data.parent_id || null,
        is_sistema: 0,
        ordem: typeof data.ordem === 'number' ? data.ordem : 99,
      };

      const row = await categoriaPecaService.create(createData);
      return { success: true, data: row, message: 'Categoria criada com sucesso' };
    } catch (error) {
      logError('Erro ao criar categoria de peça', { data, error });
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Já existe uma categoria com esta chave ou label.' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('categoria-peca:update', async (_event, id: string, data) => {
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
      if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;

      const row = await categoriaPecaService.update(id, updateData);
      if (!row) return { success: false, error: 'Categoria não encontrada' };

      return { success: true, data: row, message: 'Categoria atualizada com sucesso' };
    } catch (error) {
      logError('Erro ao atualizar categoria de peça', { id, data, error });
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Já existe uma categoria com esta chave ou label.' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('categoria-peca:delete', async (_event, id: string) => {
    try {
      if (!id || typeof id !== 'string') return { success: false, error: 'ID inválido' };
      await categoriaPecaService.delete(id);
      auditDelete('', 'categorias_pecas', id, `Categoria de peça ${id} excluída`);
      return { success: true, message: 'Categoria excluída com sucesso' };
    } catch (error) {
      logError('Erro ao excluir categoria de peça', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  logInfo('Handlers de categoria de peça registrados com sucesso');
};
