import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import { configuracaoService } from '../../services/configuracao.service.js';

/**
 * Registra handlers IPC para operações de configuração
 */
export const registerConfiguracaoHandlers = (): void => {
  /**
   * Obter valor de uma configuração
   */
  ipcMain.handle('configuracao:obter', async (_event, chave: string) => {
    try {
      if (!chave || typeof chave !== 'string') {
        return { success: false, error: 'Chave inválida' };
      }

      const valor = await configuracaoService.obter(chave);
      return { success: true, data: valor };
    } catch (error) {
      logError('Erro ao obter configuração', { chave, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });

  /**
   * Salvar/atualizar uma configuração
   */
  ipcMain.handle('configuracao:salvar', async (_event, chave: string, valor: string, tipo?: string, descricao?: string) => {
    try {
      if (!chave || typeof chave !== 'string') {
        return { success: false, error: 'Chave inválida' };
      }

      await configuracaoService.salvar(
        chave,
        valor,
        tipo || 'html',
        descricao || ''
      );

      return { success: true, message: 'Configuração salva com sucesso!' };
    } catch (error) {
      logError('Erro ao salvar configuração', { chave, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });
};
