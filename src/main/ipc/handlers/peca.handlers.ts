import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { pecaService } from '../../services/peca.service.js';
import type { PecaRow } from '../../types/database.js';

type PecaCreatePayload = Omit<PecaRow, 'id' | 'created_at' | 'updated_at'>;
type PecaUpdatePayload = Partial<Omit<PecaRow, 'id' | 'created_at' | 'updated_at'>>;

export const registerPecaHandlers = (): void => {
  ipcMain.handle('peca:findAll', async () => {
    try {
      const data = await pecaService.findAllComCategoria();
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar peças', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('peca:findById', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      const data = await pecaService.findById(id);
      if (!data) return { success: false, error: 'Peça não encontrada' };
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar peça por ID', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('peca:create', async (_event, data: PecaCreatePayload) => {
    try {
      if (!data.nome) return { success: false, error: 'Nome é obrigatório' };
      if (!data.conteudo) return { success: false, error: 'Conteúdo é obrigatório' };
      const created = await pecaService.create(data);
      return { success: true, data: created };
    } catch (error) {
      logError('Erro ao criar peça', { data, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('peca:update', async (_event, id: string, data: PecaUpdatePayload) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      const updated = await pecaService.update(id, data);
      return { success: true, data: updated };
    } catch (error) {
      logError('Erro ao atualizar peça', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('peca:delete', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      await pecaService.delete(id);
      return { success: true, message: 'Peça excluída' };
    } catch (error) {
      logError('Erro ao excluir peça', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('peca:search', async (_event, query: string) => {
    try {
      const data = await pecaService.search(query || '');
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar peças', { query, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('peca:findByCategoria', async (_event, categoriaId: string) => {
    try {
      const data = await pecaService.findByCategoria(categoriaId);
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar peças por categoria', { categoriaId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('peca:findByCategoriaRecursiva', async (_event, categoriaId: string) => {
    try {
      const data = await pecaService.findByCategoriaRecursiva(categoriaId);
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar peças por categoria (recursivo)', { categoriaId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });
};
