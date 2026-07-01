import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { wizardService } from '../../services/wizard.service.js';
import type { ArvoreWizard } from '../../services/wizard.service.js';
import type { WizardRow } from '../../types/database.js';

type WizardCreatePayload = Omit<WizardRow, 'id' | 'created_at' | 'updated_at'>;
type WizardUpdatePayload = Partial<Omit<WizardRow, 'id' | 'created_at' | 'updated_at'>>;

export const registerWizardHandlers = (): void => {
  ipcMain.handle('wizard:findAll', async () => {
    try {
      const data = await wizardService.findAllActive();
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar wizards', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('wizard:findById', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      const data = await wizardService.findById(id);
      if (!data) return { success: false, error: 'Wizard não encontrado' };
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar wizard por ID', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('wizard:findByTipoExame', async (_event, tipoExameId: string) => {
    try {
      if (!tipoExameId) return { success: false, error: 'ID do tipo de exame inválido' };
      const data = await wizardService.findByTipoExame(tipoExameId);
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar wizards por tipo de exame', { tipoExameId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('wizard:create', async (_event, data: WizardCreatePayload) => {
    try {
      if (!data.nome) return { success: false, error: 'Nome é obrigatório' };
      if (!data.tipo_exame_id) return { success: false, error: 'Tipo de exame é obrigatório' };
      if (!data.template_id) return { success: false, error: 'Template é obrigatório' };
      const created = await wizardService.create(data);
      return { success: true, data: created };
    } catch (error) {
      logError('Erro ao criar wizard', { data, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('wizard:update', async (_event, id: string, data: WizardUpdatePayload) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      const updated = await wizardService.update(id, data);
      return { success: true, data: updated };
    } catch (error) {
      logError('Erro ao atualizar wizard', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('wizard:delete', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      await wizardService.delete(id);
      return { success: true, message: 'Wizard excluído' };
    } catch (error) {
      logError('Erro ao excluir wizard', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('wizard:getArvore', async (_event, wizardId: string) => {
    try {
      if (!wizardId) return { success: false, error: 'ID do wizard inválido' };
      const arvore = await wizardService.getArvoreCompleta(wizardId);
      return { success: true, data: arvore };
    } catch (error) {
      logError('Erro ao buscar árvore do wizard', { wizardId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('wizard:saveArvore', async (_event, wizardId: string, arvore: ArvoreWizard) => {
    try {
      if (!wizardId) return { success: false, error: 'ID do wizard inválido' };
      await wizardService.saveArvoreCompleta(wizardId, arvore);
      return { success: true, message: 'Árvore salva com sucesso' };
    } catch (error) {
      logError('Erro ao salvar árvore do wizard', { wizardId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });
};
