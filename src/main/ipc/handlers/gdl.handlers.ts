import { observarConsultaGdl } from '../../services/gdl-diagnostico.service.js';
import { identificarRepGdl, completarConsultaRepGdl, obterConsultaRepConcluida, converterConsultaRepGdl, descartarConsultaRepGdl } from '../../services/gdl-consulta-local.service.js';
import { clipboard, ipcMain, type WebContents } from 'electron';
import { EMAIL_SUPORTE_LAWDO } from '../../../shared/gdl/suporte.js';
import { randomUUID } from 'crypto';
import { logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import * as gdlService from '../../services/gdl.service.js';
import { obterMinhasRepsEmCache, atualizarMinhasRepsEmCache } from '../../services/gdl-minhas-reps-cache.service.js';
import { definirListagemRepsGdlHabilitada, obterListagemRepsGdlHabilitada } from '../../services/gdl-listagem-preferencia.service.js';
import { classificarFalhaListaRepsGdl } from '../../services/gdl-minhas-reps-erro.service.js';
import { authSessaoService } from '../../services/auth-sessao.service.js';
import { converterRepGdl } from '../../services/gdl-adaptadores.service.js';
import { laudoService } from '../../services/laudo.service.js';
import { repService } from '../../services/rep.service.js';
import { listarResumosImagensLaudo, salvarImagemLaudoPorBytes } from '../../services/imagem-laudo.service.js';
import { atualizacaoRepGdlService } from '../../services/atualizacao-rep-gdl.service.js';
import type { AplicarAtualizacaoRepGdlEntrada } from '../../../shared/types/atualizacao-rep-gdl.types.js';

const remetentesConsultaGdl = new WeakSet<object>();
const revisoesAtualizacaoGdl = new Map<string, { remetenteId: number; usuarioId: string; identidade: string; expiraEm: number }>();

async function vincularRevisaoAtualizacaoGdl(remetenteId: number, consultaId: string, operacaoId: string): Promise<void> {
  const identidade = await gdlService.obterIdentidadeMinhasReps();
  await obterConsultaRepConcluida(remetenteId, consultaId);
  for (const [id, revisao] of revisoesAtualizacaoGdl) if (revisao.expiraEm <= Date.now() || revisao.remetenteId === remetenteId) revisoesAtualizacaoGdl.delete(id);
  revisoesAtualizacaoGdl.set(operacaoId, { remetenteId, usuarioId: authSessaoService.exigir(remetenteId), identidade, expiraEm: Date.now() + 10 * 60 * 1000 });
}

function vigiarConsultaGdl(remetente: WebContents): void {
  if (remetentesConsultaGdl.has(remetente)) return;
  remetentesConsultaGdl.add(remetente);
  const id = remetente.id;
  remetente.once('destroyed', () => {
    descartarConsultaRepGdl(id);
    for (const [operacaoId, revisao] of revisoesAtualizacaoGdl) if (revisao.remetenteId === id) revisoesAtualizacaoGdl.delete(operacaoId);
  });
}

function extrairNumeroEAnoDaRep(numero: string): { numero: string; ano: string } | null {
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
  ipcMain.handle('gdl:copiar-email-suporte', async event => {
    try {
      authSessaoService.exigir(event.sender.id);
      await clipboard.writeText(EMAIL_SUPORTE_LAWDO);
      return { success: true, data: { email: EMAIL_SUPORTE_LAWDO } };
    } catch (erro: unknown) {
      return { success: false, error: erro instanceof Error ? erro.message : 'Não foi possível copiar o e-mail de suporte.' };
    }
  });
  ipcMain.handle('gdl:obter-preferencia-listagem', async event => {
    try {
      authSessaoService.exigir(event.sender.id);
      return { success: true, data: { habilitada: await obterListagemRepsGdlHabilitada() } };
    } catch (erro: unknown) {
      return { success: false, error: erro instanceof Error ? erro.message : 'Não foi possível ler a preferência da listagem.' };
    }
  });

  ipcMain.handle('gdl:definir-preferencia-listagem', async (event, habilitada: unknown) => {
    try {
      authSessaoService.exigir(event.sender.id);
      if (typeof habilitada !== 'boolean') throw new Error('Preferência de listagem inválida.');
      await definirListagemRepsGdlHabilitada(habilitada);
      return { success: true, data: { habilitada } };
    } catch (erro: unknown) {
      return { success: false, error: erro instanceof Error ? erro.message : 'Não foi possível alterar a preferência da listagem.' };
    }
  });

  ipcMain.handle('gdl:obter-minhas-reps-cache', async event => {
    try {
      return { success: true, data: await obterMinhasRepsEmCache(authSessaoService.exigir(event.sender.id)) };
    } catch (erro: unknown) {
      return { success: false, error: erro instanceof Error ? erro.message : 'Não foi possível ler as REPs salvas.' };
    }
  });

  ipcMain.handle('gdl:atualizar-minhas-reps-cache', async (event, forcar: unknown) => {
    const inicio = Date.now();
    try {
      if (typeof forcar !== 'boolean') throw new Error('Opção de atualização inválida.');
      return { success: true, data: await atualizarMinhasRepsEmCache(authSessaoService.exigir(event.sender.id), forcar) };
    } catch (erro: unknown) {
      const falha = classificarFalhaListaRepsGdl(erro);
      const referencia = randomUUID();
      logError('Falha ao atualizar Minhas REPs no GDL', {
        referencia,
        codigo: falha.codigo,
        etapa: falha.etapa,
        detalhes: falha.detalhes,
        tipoErro: falha.tipoErro,
        codigoSistema: falha.codigoSistema,
        duracaoMs: Date.now() - inicio,
        pilha: erro instanceof Error ? erro.stack?.split('\n').slice(1, 5).join('\n') : undefined,
      });
      return {
        success: false,
        error: falha.detalhes,
        falha: { codigo: falha.codigo, detalhes: falha.detalhes, referencia },
      };
    }
  });
  ipcMain.handle('gdl:preparar-atualizacao-rep', async (event, repId: unknown) => {
    try {
      vigiarConsultaGdl(event.sender);
      authSessaoService.exigir(event.sender.id);
      if (typeof repId !== 'string' || !repId.trim()) throw new Error('REP inválida.');
      const rep = await repService.findById(repId);
      if (!rep) throw new Error('REP não encontrada.');
      const numero = extrairNumeroEAnoDaRep(rep.numero);
      if (!numero) throw new Error('Número de REP inválido.');
      const identificacao = await identificarRepGdl(event.sender.id, numero.numero, numero.ano);
      if (identificacao.detalhes?.estado === 'aguardando_confirmacao') return { success: true, data: {
        operacaoId: '', repId, repNumero: rep.numero, codigoExame: identificacao.identificacao.codigoSugerido ?? '', diferencas: [], avisos: identificacao.avisos, consultaDetalhes: identificacao,
      } };
      const consulta = await obterConsultaRepConcluida(event.sender.id, identificacao.consultaId);
      const previa = await atualizacaoRepGdlService.preparar(repId, consulta.resultado, consulta.camposVaziosConfirmados);
      await vincularRevisaoAtualizacaoGdl(event.sender.id, identificacao.consultaId, previa.operacaoId);
      return { success: true, data: { ...previa, avisos: [...new Set([...previa.avisos, ...consulta.avisos])] } };
    } catch (erro: unknown) { return { success: false, error: erro instanceof Error ? erro.message : 'Falha ao preparar atualização.' }; }
  });
  ipcMain.handle('gdl:completar-atualizacao-rep', async (event, repId: unknown, consultaId: unknown, abrirDetalhes: unknown) => {
    try {
      authSessaoService.exigir(event.sender.id);
      if (typeof repId !== 'string' || typeof consultaId !== 'string' || typeof abrirDetalhes !== 'boolean') throw new Error('Decisão inválida.');
      await completarConsultaRepGdl(event.sender.id, consultaId, abrirDetalhes);
      const consulta = await obterConsultaRepConcluida(event.sender.id, consultaId);
      const rep = await repService.findById(repId);
      const numero = rep && extrairNumeroEAnoDaRep(rep.numero);
      if (!numero || numero.numero !== consulta.numero || numero.ano !== consulta.ano) throw new Error('A revisão não corresponde à REP local.');
      const previa = await atualizacaoRepGdlService.preparar(repId, consulta.resultado, consulta.camposVaziosConfirmados);
      await vincularRevisaoAtualizacaoGdl(event.sender.id, consultaId, previa.operacaoId);
      return { success: true, data: { ...previa, avisos: [...new Set([...previa.avisos, ...consulta.avisos])] } };
    } catch (erro: unknown) { return { success: false, error: erro instanceof Error ? erro.message : 'Falha ao preparar atualização.' }; }
  });

  ipcMain.handle('gdl:aplicar-atualizacao-rep', async (event, entrada: unknown) => {
    try {
      if (!entrada || typeof entrada !== 'object') return { success: false, error: 'Dados de atualização inválidos.' };
      const dados = entrada as Partial<AplicarAtualizacaoRepGdlEntrada>;
      if (typeof dados.operacaoId !== 'string' || !Array.isArray(dados.diferencasSelecionadas) || typeof dados.reabrirLaudo !== 'boolean'
        || dados.diferencasSelecionadas.some(id => typeof id !== 'string')) return { success: false, error: 'Dados de atualização inválidos.' };
      const revisao = revisoesAtualizacaoGdl.get(dados.operacaoId);
      if (!revisao || revisao.remetenteId !== event.sender.id || revisao.usuarioId !== authSessaoService.exigir(event.sender.id)
        || revisao.expiraEm <= Date.now() || revisao.identidade !== await gdlService.obterIdentidadeMinhasReps()) throw new Error('A revisão expirou ou a sessão GDL mudou. Consulte novamente.');
      const resultado = await atualizacaoRepGdlService.aplicar(dados as AplicarAtualizacaoRepGdlEntrada);
      revisoesAtualizacaoGdl.delete(dados.operacaoId);
      return { success: true, data: resultado };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Não foi possível aplicar a atualização da REP.' };
    }
  });

  ipcMain.handle('gdl:testar-conexao', async (event, ambiente: string) => {
    try {
      const resultado = await observarConsultaGdl(event.sender.id, '', '', () => gdlService.testarConexao(ambiente || 'producao'));
      return { success: true, data: resultado };
    } catch (error) {
      const amb = ambiente || 'producao';
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

  ipcMain.handle('gdl:validar-credenciais', async (event, ambiente: string, credenciais: { login: string; senha: string; cpfUsuario?: string }, numero: string, ano: string) => {
    try {
      if (!numero || typeof numero !== 'string' || !ano || typeof ano !== 'string') {
        return { success: false, error: 'Número e ano da REP são obrigatórios.' };
      }

      const resultado = await observarConsultaGdl(event.sender.id, sanitizeInput(numero), sanitizeInput(ano), () => gdlService.validarCredenciais(
        ambiente || 'producao',
        {
          login: sanitizeInput(credenciais?.login || ''),
          senha: credenciais?.senha || '',
          cpfUsuario: sanitizeInput(credenciais?.cpfUsuario || ''),
        },
        sanitizeInput(numero),
        sanitizeInput(ano),
      ));

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

  ipcMain.handle('gdl:identificar-rep', async (event, numero: unknown, ano: unknown, naturezaLista: unknown) => {
    try {
      authSessaoService.exigir(event.sender.id);
      if (typeof numero !== 'string' || !/^\d{1,12}$/.test(numero)
        || typeof ano !== 'string' || !/^\d{4}$/.test(ano)
        || (naturezaLista !== undefined && (typeof naturezaLista !== 'string' || naturezaLista.length > 500))) {
        throw new Error('Identificação da REP inválida.');
      }
      vigiarConsultaGdl(event.sender);
      const data = await identificarRepGdl(event.sender.id, numero, ano, naturezaLista);
      return { success: true, data };
    } catch (erro: unknown) {
      return { success: false, error: erro instanceof Error ? erro.message : 'Não foi possível identificar o exame.' };
    }
  });

  ipcMain.handle('gdl:completar-consulta-rep', async (event, consultaId: unknown, abrirDetalhes: unknown) => {
    try {
      authSessaoService.exigir(event.sender.id);
      if (typeof consultaId !== 'string' || typeof abrirDetalhes !== 'boolean') throw new Error('Decisão de consulta inválida.');
      return { success: true, data: await completarConsultaRepGdl(event.sender.id, consultaId, abrirDetalhes) };
    } catch (erro: unknown) { return { success: false, error: erro instanceof Error ? erro.message : 'Falha ao consultar detalhes.' }; }
  });
  ipcMain.handle('gdl:descartar-consulta-rep', async event => {
    authSessaoService.exigir(event.sender.id);
    descartarConsultaRepGdl(event.sender.id);
    return { success: true };
  });

  ipcMain.handle('gdl:converter-consulta-rep', async (event, consultaId: unknown, tipoExameId: unknown) => {
    try {
      authSessaoService.exigir(event.sender.id);
      if (typeof consultaId !== 'string' || typeof tipoExameId !== 'string' || !tipoExameId.trim()) {
        throw new Error('Escolha do tipo de exame inválida.');
      }
      return { success: true, data: await converterConsultaRepGdl(event.sender.id, consultaId, tipoExameId) };
    } catch (erro: unknown) {
      return { success: false, error: erro instanceof Error ? erro.message : 'Não foi possível converter os dados.' };
    }
  });

  ipcMain.handle('gdl:consultar-rep', async (event, numero: string, ano: string) => {
    try {
      if (!numero || typeof numero !== 'string' || !ano || typeof ano !== 'string') {
        return { success: false, error: 'Número e ano da REP são obrigatórios.' };
      }

      const resultado = await observarConsultaGdl(event.sender.id, sanitizeInput(numero), sanitizeInput(ano), () => gdlService.consultarRep(sanitizeInput(numero), sanitizeInput(ano)));
      if (!resultado.sucesso || !resultado.dados) {
        return { success: false, error: resultado.erro || 'Erro ao consultar REP no GDL' };
      }
      const naturezaExameGdl = resultado.naturezaExame?.trim() || '';
      const codigoExame = gdlService.extrairCodigoNaturezaExame(naturezaExameGdl);
      if (!codigoExame) {
        return { success: false, error: resultado.erroNaturezaExame || 'O GDL não retornou uma natureza de exame identificável para esta REP.' };
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
            ambiente: resultado.ambiente ?? 'producao',
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

  ipcMain.handle('gdl:listar-imagens-laudo', async (event, laudoId: unknown) => {
    try {
      const { numero, ano } = await resolverRepDoLaudo(laudoId);
      if (typeof laudoId !== 'string') return { success: false, error: 'Laudo inválido.' };
      return {
        success: true,
        data: await gdlService.abrirSessaoImagensRepGdl(laudoId, numero, ano, progresso => {
          if (!event.sender.isDestroyed()) event.sender.send('gdl:progresso-imagens-laudo', { laudoId, ...progresso });
        }),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido ao listar imagens da REP.' };
    }
  });

  ipcMain.handle('gdl:obter-miniaturas-imagens-laudo', async (_event, laudoId: unknown, sessaoId: unknown, idsSelecao: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof sessaoId !== 'string' || !/^[a-z0-9-]{36}$/i.test(sessaoId)
        || !Array.isArray(idsSelecao) || idsSelecao.length > 30
        || idsSelecao.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) {
        return { success: false, error: 'Solicitação de miniaturas inválida.' };
      }
      return { success: true, data: await gdlService.obterMiniaturasDaSessaoImagensRepGdl(laudoId, sessaoId, idsSelecao) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao preparar miniaturas da REP.' };
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
