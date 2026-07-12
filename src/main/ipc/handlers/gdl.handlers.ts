import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import * as gdlService from '../../services/gdl.service.js';
import { converterRepB602 } from '../../services/gdl-b602-normalizador.service.js';

export const registerGdlHandlers = (): void => {
  ipcMain.handle('gdl:testar-conexao', async (_event, ambiente: string) => {
    try {
      const resultado = await gdlService.testarConexao(ambiente || 'homologacao');
      return { success: true, data: resultado };
    } catch (error) {
      const amb = ambiente || 'homologacao';
      const ambLabel = amb === 'producao' ? 'Produção' : 'Homologação';
      logError(`Falha ao testar conexão GDL em ambiente ${ambLabel}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao testar conexão GDL',
      };
    }
  });

  ipcMain.handle('gdl:obter-validacao-sessao', async (_event, ambiente?: string) => {
    try {
      return { success: true, data: gdlService.obterValidacaoSessao(ambiente) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao obter validação GDL',
      };
    }
  });

  ipcMain.handle('gdl:limpar-validacao-sessao', async (_event, ambiente?: string) => {
    try {
      return { success: true, data: gdlService.limparValidacaoSessao(ambiente) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao limpar validação GDL',
      };
    }
  });

  ipcMain.handle('gdl:validar-credenciais', async (_event, ambiente: string, credenciais: { login: string; senha: string; cpfUsuario?: string }, numero: string, ano: string) => {
    try {
      if (!numero || typeof numero !== 'string' || !ano || typeof ano !== 'string') {
        return { success: false, error: 'Número e ano da REP são obrigatórios.' };
      }

      const resultado = await gdlService.validarCredenciais(
        ambiente || 'homologacao',
        {
          login: sanitizeInput(credenciais?.login || ''),
          senha: credenciais?.senha || '',
          cpfUsuario: sanitizeInput(credenciais?.cpfUsuario || ''),
        },
        sanitizeInput(numero),
        sanitizeInput(ano),
      );

      if (!resultado.sucesso) {
        return { success: false, error: resultado.erro || 'Erro ao validar credenciais do GDL' };
      }

      return { success: true, data: resultado.dados };
    } catch (error) {
      logError(`Falha ao validar credenciais GDL com REP ${sanitizeInput(numero)}/${sanitizeInput(ano)}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao validar credenciais GDL',
      };
    }
  });

  ipcMain.handle('gdl:consultar-rep', async (_event, numero: string, ano: string) => {
    try {
      if (!numero || typeof numero !== 'string' || !ano || typeof ano !== 'string') {
        return { success: false, error: 'Número e ano da REP são obrigatórios.' };
      }

      const resultado = await gdlService.consultarRep(sanitizeInput(numero), sanitizeInput(ano));
      if (!resultado.sucesso || !resultado.dados) {
        return { success: false, error: resultado.erro || 'Erro ao consultar REP no GDL' };
      }

      return {
        success: true,
        data: converterRepB602(resultado.dados, {
          origemInicial: 'gdl',
          ultimaConsulta: {
            ambiente: resultado.ambiente ?? 'homologacao',
            numeroRep: sanitizeInput(numero),
            anoRep: sanitizeInput(ano),
            consultadoEm: new Date().toISOString(),
          },
        }),
      };
    } catch (error) {
      logError(`Falha ao consultar REP ${sanitizeInput(numero)}/${sanitizeInput(ano)} no GDL`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao consultar REP',
      };
    }
  });
};
