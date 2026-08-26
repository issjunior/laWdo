import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import { logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import * as gdlService from '../../services/gdl.service.js';
import { converterRepGdl } from '../../services/gdl-adaptadores.service.js';
import { laudoService } from '../../services/laudo.service.js';
import { repService } from '../../services/rep.service.js';
import { listarResumosImagensLaudo, salvarImagemLaudoPorBytes } from '../../services/imagem-laudo.service.js';

export function extrairNumeroEAnoDaRep(numero: string): { numero: string; ano: string } | null {
  const correspondencia = numero.trim().match(/^([\d.\s]+)\s*[/\\-]\s*(\d{4})$/);
  if (!correspondencia) return null;
  const numeroNormalizado = correspondencia[1].replace(/\D/g, '');
  return numeroNormalizado ? { numero: numeroNormalizado, ano: correspondencia[2] } : null;
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
      const naturezaExameGdl = resultado.naturezaExame?.trim() || '';
      const codigoExame = gdlService.extrairCodigoNaturezaExame(naturezaExameGdl);
      if (!codigoExame) {
        return { success: false, error: 'O GDL não retornou uma natureza de exame identificável para esta REP.' };
      }
      if (codigoExame !== 'B-602') {
        return {
          success: false,
          error: `O formulário para a natureza de exame ${naturezaExameGdl} ainda está em desenvolvimento no laWdo. Os dados não foram importados.`,
        };
      }

      return {
        success: true,
        data: {
          ...converterRepGdl(codigoExame, resultado.dados, {
          origemInicial: 'gdl',
          ultimaConsulta: {
            ambiente: resultado.ambiente ?? 'homologacao',
            numeroRep: sanitizeInput(numero),
            anoRep: sanitizeInput(ano),
            consultadoEm: new Date().toISOString(),
          },
          }),
          naturezaExameGdl,
        },
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
      if (typeof laudoId !== 'string') return { success: false, error: 'Laudo inválido.' };
      return { success: true, data: await gdlService.abrirSessaoImagensRepGdl(laudoId, numero, ano) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao listar imagens da REP.' };
    }
  });

  ipcMain.handle('gdl:capturar-imagens-laudo', async (_event, laudoId: unknown, sessaoId: unknown, idsSelecao: unknown, permitirDuplicadas: unknown) => {
    try {
      if (typeof sessaoId !== 'string' || !/^[a-z0-9-]{36}$/i.test(sessaoId) || !Array.isArray(idsSelecao) || idsSelecao.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) {
        return { success: false, error: 'Seleção de imagens inválida.' };
      }
      if (typeof laudoId !== 'string') return { success: false, error: 'Laudo inválido.' };
      if (typeof permitirDuplicadas !== 'undefined' && typeof permitirDuplicadas !== 'boolean') {
        return { success: false, error: 'Confirmação de duplicatas inválida.' };
      }
      await resolverRepDoLaudo(laudoId);
      const existentes = await listarResumosImagensLaudo(laudoId);
      let proximaSequencia = existentes.reduce((maior, imagem) => Math.max(maior, imagem.sequencia), 0) + 1;
      const resultado = await gdlService.capturarImagensDaSessaoGdlParaLaudo(laudoId, sessaoId, idsSelecao, async imagem => {
        const sequencia = proximaSequencia;
        const persistida = await salvarImagemLaudoPorBytes(laudoId, {
          id: randomUUID(),
          nomeArquivo: imagem.nomeArquivo,
          mimeType: imagem.mimeType,
          bytes: imagem.bytes,
          legenda: imagem.nomeArquivo.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(),
          origem: 'gdl',
          sequencia,
          permitirDuplicada: permitirDuplicadas === true,
        });
        if ('localizacao' in persistida) {
          return {
            idSelecao: imagem.idSelecao,
            nomeArquivo: imagem.nomeArquivo,
            imagemExistenteId: persistida.id,
            localizacao: persistida.localizacao,
          };
        }
        proximaSequencia += 1;
        return {
          idSelecao: imagem.idSelecao,
          imagemId: persistida.id,
          nomeArquivo: persistida.nomeArquivo,
          mimeType: persistida.mimeType,
          tamanho: persistida.tamanho,
          sha256: persistida.sha256,
          sequencia: persistida.sequencia,
        };
      });
      return { success: true, data: resultado };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao capturar imagens da REP.' };
    }
  });

  ipcMain.handle('gdl:fechar-sessao-imagens-laudo', async (_event, laudoId: unknown, sessaoId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof sessaoId !== 'string') throw new Error('Sessão de imagens inválida.')
      gdlService.fecharSessaoImagensRepGdl(laudoId, sessaoId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao liberar a sessão de imagens.' }
    }
  })
};
