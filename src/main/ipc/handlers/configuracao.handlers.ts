import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { configuracaoService } from '../../services/configuracao.service.js';
import { authSessaoService } from '../../services/auth-sessao.service.js';

function ehConfiguracaoPrivadaGoogleDrive(chave: string): boolean {
  return chave.startsWith('google_drive_');
}

function ehCredencialPrivada(chave: string): boolean {
  return ehConfiguracaoPrivadaGoogleDrive(chave)
    || chave.startsWith('gdl_login_')
    || chave.startsWith('gdl_senha_')
    || chave.startsWith('gdl_cpf_usuario_')
    || chave.startsWith('api_key_');
}

/**
 * Registra handlers IPC para operações de configuração
 */
export const registerConfiguracaoHandlers = (): void => {
  /**
   * Obter valor de uma configuração
   */
  ipcMain.handle('configuracao:obter', async (event, chave: string) => {
    try {
      authSessaoService.exigir(event.sender.id);
      if (!chave || typeof chave !== 'string') {
        return { success: false, error: 'Chave inválida' };
      }
      if (ehCredencialPrivada(chave)) {
        return { success: false, error: 'Esta credencial é administrada pela integração responsável.' };
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
  ipcMain.handle('configuracao:salvar', async (event, chave: string, valor: string, tipo?: string, descricao?: string) => {
    try {
      authSessaoService.exigir(event.sender.id);
      if (!chave || typeof chave !== 'string') {
        return { success: false, error: 'Chave inválida' };
      }
      if (ehCredencialPrivada(chave) || tipo === 'senha' || tipo === 'api_key') {
        return { success: false, error: 'Esta credencial é administrada pela integração responsável.' };
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
