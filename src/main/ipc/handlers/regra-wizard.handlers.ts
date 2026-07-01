import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { regraWizardService } from '../../services/regra-wizard.service.js';
import type { RegraWizardRow } from '../../types/database.js';

type RegraWizardPayload = Omit<RegraWizardRow, 'created_at'>;
type RespostasWizardPayload = Record<string, string | string[]>;

export const registerRegraWizardHandlers = (): void => {
  ipcMain.handle('regra-wizard:findByWizard', async (_event, wizardId: string) => {
    try {
      if (!wizardId) return { success: false, error: 'ID do wizard inválido' };
      const data = await regraWizardService.findByWizardWithPecas(wizardId);
      return { success: true, data };
    } catch (error) {
      logError('Erro ao buscar regras do wizard', { wizardId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('regra-wizard:save', async (_event, regras: RegraWizardPayload[]) => {
    try {
      await regraWizardService.saveBatch(regras);
      return { success: true, message: 'Regras salvas' };
    } catch (error) {
      logError('Erro ao salvar regras do wizard', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  ipcMain.handle('regra-wizard:calcularPecas', async (_event, wizardId: string, respostas: RespostasWizardPayload) => {
    try {
      if (!wizardId) return { success: false, error: 'ID do wizard inválido' };
      const data = await regraWizardService.calcularPecas(wizardId, respostas || {});
      return { success: true, data };
    } catch (error) {
      logError('Erro ao calcular peças do wizard', { wizardId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });
};
