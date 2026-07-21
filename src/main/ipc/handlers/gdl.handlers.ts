import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import * as gdlService from '../../services/gdl.service.js';
import { converterRepGdl } from '../../services/gdl-adaptadores.service.js';
import { laudoService } from '../../services/laudo.service.js';
import { repService } from '../../services/rep.service.js';

function extrairNumeroEAnoDaRep(numero: string): { numero: string; ano: string } | null {
  const correspondencia = numero.trim().match(/^(\d+)\s*[/\\-]\s*(\d{4})$/);
  return correspondencia ? { numero: correspondencia[1], ano: correspondencia[2] } : null;
}

async function resolverRepDoLaudo(laudoId: unknown): Promise<{ numero: string; ano: string }> {
  if (typeof laudoId !== 'string' || !laudoId.trim()) throw new Error('Laudo inválido.');
  const laudo = await laudoService.findById(laudoId);
  if (!laudo) throw new Error('Laudo não encontrado.');
  const rep = await repService.findById(laudo.rep_id);
  if (!rep) throw new Error('REP associada ao laudo não encontrada.');
  const identificacao = extrairNumeroEAnoDaRep(rep.numero);
  if (!identificacao) throw new Error('O número da REP deve estar no formato número/ano para consultar imagens no GDL.');
  return identificacao;
}

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
        data: converterRepGdl('B-602', resultado.dados, {
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

  ipcMain.handle('gdl:listar-imagens-laudo', async (_event, laudoId: unknown) => {
    try {
      const { numero, ano } = await resolverRepDoLaudo(laudoId);
      const arquivos = await gdlService.listarImagensRepGdl(numero, ano);
      return { success: true, data: arquivos };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao listar imagens da REP.' };
    }
  });

  ipcMain.handle('gdl:capturar-imagens-laudo', async (_event, laudoId: unknown, idsSelecao: unknown) => {
    try {
      if (!Array.isArray(idsSelecao) || idsSelecao.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) {
        return { success: false, error: 'Seleção de imagens inválida.' };
      }
      const { numero, ano } = await resolverRepDoLaudo(laudoId);
      const resultado = await gdlService.capturarImagensRepGdl(numero, ano, idsSelecao);
      return { success: true, data: resultado };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao capturar imagens da REP.' };
    }
  });
};
