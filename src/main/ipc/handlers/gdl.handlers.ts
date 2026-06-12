import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import * as gdlService from '../../services/gdl.service.js';

export const registerGdlHandlers = (): void => {
  ipcMain.handle('gdl:testar-conexao', async (_event, ambiente: string) => {
    try {
      const resultado = await gdlService.testarConexao(ambiente || 'homologacao');
      return { success: true, data: resultado };
    } catch (error) {
      logError('Erro no handler gdl:testar-conexao', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao testar conexão GDL',
      };
    }
  });

  ipcMain.handle('gdl:consultar-rep', async (_event, numero: string, ano: string) => {
    try {
      if (!numero || typeof numero !== 'string' || !ano || typeof ano !== 'string') {
        return { success: false, error: 'Número e ano da REP são obrigatórios.' };
      }

      const resultado = await gdlService.consultarRep(sanitizeInput(numero), sanitizeInput(ano));
      if (!resultado.sucesso) {
        return { success: false, error: resultado.erro || 'Erro ao consultar REP no GDL' };
      }

      return { success: true, data: resultado.dados };
    } catch (error) {
      logError('Erro no handler gdl:consultar-rep', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao consultar REP',
      };
    }
  });
};
