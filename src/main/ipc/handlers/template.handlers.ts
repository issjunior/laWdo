import { ipcMain } from 'electron';
import { logInfo, logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import { templateService } from '../../services/template.service.js';

export const registerTemplateHandlers = (): void => {
  /** Listar todos os templates (com contagem de seções) */
  ipcMain.handle('template:findAll', async () => {
    try {
      const data = await templateService.findAllComSecoes();
      return { success: true, data };
    } catch (error: any) {
      logError('Erro ao listar templates', error);
      return { success: false, error: error.message };
    }
  });

  /** Buscar template por ID */
  ipcMain.handle('template:findById', async (_event, id: string) => {
    try {
      const data = await templateService.findById(id);
      if (!data) return { success: false, error: 'Template não encontrado' };
      return { success: true, data };
    } catch (error: any) {
      logError('Erro ao buscar template', error);
      return { success: false, error: error.message };
    }
  });

  /** Buscar templates por tipo de exame */
  ipcMain.handle('template:findByTipoExame', async (_event, tipoExameId: string) => {
    try {
      const data = await templateService.findByTipoExame(tipoExameId);
      return { success: true, data };
    } catch (error: any) {
      logError('Erro ao buscar templates por tipo de exame', error);
      return { success: false, error: error.message };
    }
  });

  /** Criar template */
  ipcMain.handle('template:create', async (_event, data: { nome: string; tipo_exame_id: string; descricao?: string }) => {
    try {
      if (!data.nome || !data.nome.trim()) {
        return { success: false, error: 'Nome do template é obrigatório' };
      }
      if (!data.tipo_exame_id) {
        return { success: false, error: 'Tipo de exame é obrigatório' };
      }
      const template = await templateService.create({
        nome: sanitizeInput(data.nome.trim()),
        tipo_exame_id: data.tipo_exame_id,
        descricao: data.descricao ? sanitizeInput(data.descricao) : undefined,
      });
      logInfo(`Template criado: ${template.nome}`);
      return { success: true, data: template, message: 'Template criado com sucesso' };
    } catch (error: any) {
      logError('Erro ao criar template', error);
      return { success: false, error: error.message };
    }
  });

  /** Atualizar template */
  ipcMain.handle('template:update', async (_event, id: string, data: { nome?: string; tipo_exame_id?: string; descricao?: string }) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.nome !== undefined) updateData.nome = sanitizeInput(data.nome);
      if (data.tipo_exame_id !== undefined) updateData.tipo_exame_id = data.tipo_exame_id;
      if (data.descricao !== undefined) updateData.descricao = data.descricao ? sanitizeInput(data.descricao) : null;

      const template = await templateService.update(id, updateData);
      logInfo(`Template atualizado: ${id}`);
      return { success: true, data: template, message: 'Template atualizado com sucesso' };
    } catch (error: any) {
      logError('Erro ao atualizar template', error);
      return { success: false, error: error.message };
    }
  });

  /** Excluir template */
  ipcMain.handle('template:delete', async (_event, id: string) => {
    try {
      await templateService.delete(id);
      logInfo(`Template excluído: ${id}`);
      return { success: true, message: 'Template excluído com sucesso' };
    } catch (error: any) {
      logError('Erro ao excluir template', error);
      return { success: false, error: error.message };
    }
  });

  // ─── Seções ───────────────────────────────────────────

  /** Listar seções de um template */
  ipcMain.handle('template:findSecoes', async (_event, templateId: string) => {
    try {
      const data = await templateService.findSecoesByTemplate(templateId);
      return { success: true, data };
    } catch (error: any) {
      logError('Erro ao listar seções do template', error);
      return { success: false, error: error.message };
    }
  });

  /** Criar seção */
  ipcMain.handle('template:createSecao', async (_event, data: { template_id: string; nome: string; ordem: number; conteudo?: string }) => {
    try {
      if (!data.nome || !data.nome.trim()) {
        return { success: false, error: 'Nome da seção é obrigatório' };
      }
      const secao = await templateService.createSecao({
        template_id: data.template_id,
        nome: sanitizeInput(data.nome.trim()),
        ordem: data.ordem ?? 0,
        conteudo: data.conteudo || undefined,
      });
      return { success: true, data: secao, message: 'Seção criada com sucesso' };
    } catch (error: any) {
      logError('Erro ao criar seção', error);
      return { success: false, error: error.message };
    }
  });

  /** Atualizar seção */
  ipcMain.handle('template:updateSecao', async (_event, id: string, data: { nome?: string; ordem?: number; conteudo?: string }) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.nome !== undefined) updateData.nome = sanitizeInput(data.nome);
      if (data.ordem !== undefined) updateData.ordem = data.ordem;
      if (data.conteudo !== undefined) updateData.conteudo = data.conteudo;

      const secao = await templateService.updateSecao(id, updateData);
      return { success: true, data: secao, message: 'Seção atualizada com sucesso' };
    } catch (error: any) {
      logError('Erro ao atualizar seção', error);
      return { success: false, error: error.message };
    }
  });

  /** Excluir seção */
  ipcMain.handle('template:deleteSecao', async (_event, id: string) => {
    try {
      await templateService.deleteSecao(id);
      return { success: true, message: 'Seção excluída com sucesso' };
    } catch (error: any) {
      logError('Erro ao excluir seção', error);
      return { success: false, error: error.message };
    }
  });

  /** Reordenar seções */
  ipcMain.handle('template:reordenarSecoes', async (_event, templateId: string, idsOrdenados: string[]) => {
    try {
      await templateService.reordenarSecoes(templateId, idsOrdenados);
      return { success: true, message: 'Seções reordenadas com sucesso' };
    } catch (error: any) {
      logError('Erro ao reordenar seções', error);
      return { success: false, error: error.message };
    }
  });
};
