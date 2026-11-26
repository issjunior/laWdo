import { app, ipcMain } from 'electron';
import type { Dirent } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { authSessaoService } from '../../services/auth-sessao.service.js';
import { ErroGoogleDrive, googleDriveService } from '../../services/google-drive.service.js';
import { analisarConflitosBkp, importarBkpLaudo } from '../../services/laudo-bkp.service.js';
import type { PacoteLaudo } from '../../../shared/types/laudo-bkp.types.js';

const DURACAO_CACHE_MS = 5 * 60_000;
const PREFIXO_CACHE_GOOGLE_DRIVE = 'google-drive-cache-';

interface PacoteTemporario { id: string; janelaId: number; usuarioId: string; copiaId: string; revisao: string; hashCifrado: string; pacote: PacoteLaudo; diretorio: string; expiraEm: number }
interface RestauracaoPreparada { janelaId: number; usuarioId: string; copiaId: string; revisao: string; identidadeCaso: string; cacheId: string; expiraEm: number }
interface VerificacaoEmAndamento { janelaId: number; usuarioId: string; controlador: AbortController }

const pacotes = new Map<string, PacoteTemporario>();
const restauracoes = new Map<string, RestauracaoPreparada>();
const verificacoes = new Map<string, VerificacaoEmAndamento>();

function respostaErro(erro: unknown) {
  return { success: false, error: erro instanceof Error ? erro.message : 'Erro inesperado na integração com o Google Drive.', diagnostico: erro instanceof ErroGoogleDrive ? { etapa: erro.etapa, codigo: erro.codigo } : { etapa: 'desconhecida', codigo: 'erro_inesperado' } };
}
function usuario(evento: Electron.IpcMainInvokeEvent) { return authSessaoService.exigir(evento.sender.id); }
async function limparTemporario(diretorio: string) { await rm(diretorio, { recursive: true, force: true }).catch(() => undefined); }
async function descartarPacote(id: string): Promise<void> { const pacote = pacotes.get(id); pacotes.delete(id); if (pacote) await limparTemporario(pacote.diretorio); }
export async function limparPacotesGoogleDriveAtivos(): Promise<void> {
  await Promise.all(Array.from(pacotes.keys()).map(descartarPacote));
  restauracoes.clear();
  for (const verificacao of verificacoes.values()) verificacao.controlador.abort();
  verificacoes.clear();
}

export async function limparCachesGoogleDriveOrfaos(): Promise<void> {
  const diretorioDados = app.getPath('userData');
  let entradas: Dirent[];
  try {
    entradas = await readdir(diretorioDados, { withFileTypes: true });
  } catch (erro) {
    if (erro instanceof Error && 'code' in erro && erro.code === 'ENOENT') return;
    throw erro;
  }
  await Promise.all(entradas
    .filter(entrada => entrada.isDirectory() && entrada.name.startsWith(PREFIXO_CACHE_GOOGLE_DRIVE))
    .map(entrada => limparTemporario(path.join(diretorioDados, entrada.name))));
}

async function limparPacotesDaJanela(janelaId: number): Promise<void> {
  await Promise.all(Array.from(pacotes.values()).filter(item => item.janelaId === janelaId).map(item => descartarPacote(item.id)));
  for (const [id, operacao] of restauracoes) if (operacao.janelaId === janelaId) restauracoes.delete(id);
  for (const [id, verificacao] of verificacoes) {
    if (verificacao.janelaId === janelaId) { verificacao.controlador.abort(); verificacoes.delete(id); }
  }
}

async function obterPacote(evento: Electron.IpcMainInvokeEvent, copiaId: string): Promise<PacoteTemporario> {
  const usuarioId = usuario(evento);
  const existente = Array.from(pacotes.values()).find(item => item.janelaId === evento.sender.id && item.usuarioId === usuarioId && item.copiaId === copiaId && item.expiraEm > Date.now());
  if (existente) { await googleDriveService.conferirCopiaAtual(usuarioId, copiaId, existente.revisao); return existente; }
  const diretorio = await mkdtemp(path.join(app.getPath('userData'), 'google-drive-cache-'));
  try {
    const lido = await googleDriveService.lerPacoteCopia(usuarioId, copiaId, diretorio);
    const item: PacoteTemporario = { id: randomUUID(), janelaId: evento.sender.id, usuarioId, copiaId, revisao: lido.revisao, hashCifrado: lido.hashCifrado, pacote: lido.pacote, diretorio, expiraEm: Date.now() + DURACAO_CACHE_MS };
    pacotes.set(item.id, item);
    setTimeout(() => { void descartarPacote(item.id); }, DURACAO_CACHE_MS).unref();
    return item;
  } catch (erro) { await limparTemporario(diretorio); throw erro; }
}

function obterRestauracao(evento: Electron.IpcMainInvokeEvent, operacaoId: unknown): RestauracaoPreparada {
  const usuarioId = usuario(evento); const operacao = typeof operacaoId === 'string' ? restauracoes.get(operacaoId) : undefined;
  if (!operacao || operacao.janelaId !== evento.sender.id || operacao.usuarioId !== usuarioId || operacao.expiraEm < Date.now()) throw new Error('A restauração expirou. Selecione a cópia novamente.');
  return operacao;
}
function htmlVisualizacao(pacote: PacoteLaudo) {
  return {
    html: pacote.laudo.conteudo,
    contexto: {
      rep: pacote.rep,
      tipoExame: pacote.tipoExame,
      solicitante: pacote.solicitante,
      placeholders: pacote.placeholders,
    },
    apresentacaoJson: pacote.laudo.apresentacao_json ?? undefined,
  };
}

export function registrarGoogleDriveHandlers(): void {
  const observadas = new WeakSet<Electron.WebContents>();
  const observar = (evento: Electron.IpcMainInvokeEvent) => {
    if (observadas.has(evento.sender)) return;
    observadas.add(evento.sender);
    evento.sender.once('destroyed', () => { void limparPacotesDaJanela(evento.sender.id); });
  };
  ipcMain.handle('google-drive:estado-rapido', async evento => { try { return { success: true, data: await googleDriveService.estadoRapido(usuario(evento)) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:estado', async evento => { try { return { success: true, data: await googleDriveService.estado(usuario(evento)) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:resumo-cache', async evento => { try { return { success: true, data: await googleDriveService.resumoCache(usuario(evento)) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:resumo', async (evento, forcarAtualizacao: unknown) => { try { if (forcarAtualizacao !== undefined && typeof forcarAtualizacao !== 'boolean') throw new Error('Atualização inválida.'); return { success: true, data: await googleDriveService.resumo(usuario(evento), forcarAtualizacao === true) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:conectar', async evento => { try { return { success: true, data: await googleDriveService.conectar(usuario(evento)) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:desconectar', async evento => { try { await limparPacotesDaJanela(evento.sender.id); return { success: true, data: await googleDriveService.desconectar(usuario(evento)) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:abrir-pasta', async evento => { try { await googleDriveService.abrirPasta(usuario(evento)); return { success: true }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:definir-envio-automatico', async (evento, ativo: unknown) => { try { if (typeof ativo !== 'boolean') throw new Error('Configuração inválida.'); return { success: true, data: await googleDriveService.definirEnvioAutomatico(usuario(evento), ativo) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:listar-copias', async evento => { try { return { success: true, data: await googleDriveService.listarCopias(usuario(evento)) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:listar-laudos-concluidos', async evento => { try { return { success: true, data: await googleDriveService.listarLaudosConcluidos(usuario(evento)) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:enviar-laudo', async (evento, laudoId: unknown, confirmarSubstituicao: unknown) => { try { if (typeof laudoId !== 'string' || typeof confirmarSubstituicao !== 'boolean') throw new Error('Dados de envio inválidos.'); return { success: true, data: await googleDriveService.enviarLaudo(usuario(evento), laudoId, confirmarSubstituicao) }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:verificar', async (evento, copiaId: unknown, operacaoId: unknown) => {
    try {
      if (typeof copiaId !== 'string' || typeof operacaoId !== 'string' || !/^[\w-]{16,100}$/.test(operacaoId)) throw new Error('Dados de verificação inválidos.');
      observar(evento);
      const usuarioId = usuario(evento);
      if (verificacoes.has(operacaoId)) throw new Error('Já existe uma verificação com este identificador.');
      const controlador = new AbortController();
      verificacoes.set(operacaoId, { janelaId: evento.sender.id, usuarioId, controlador });
      try {
        return {
          success: true,
          data: await googleDriveService.verificar(usuarioId, copiaId, controlador.signal, (recebidos, total) => {
            if (!evento.sender.isDestroyed()) evento.sender.send('google-drive:progresso-verificacao', { operacaoId, recebidos, total });
          }),
        };
      }
      finally { verificacoes.delete(operacaoId); }
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:cancelar-verificacao', (evento, operacaoId: unknown) => {
    try {
      const usuarioId = usuario(evento);
      const verificacao = typeof operacaoId === 'string' ? verificacoes.get(operacaoId) : undefined;
      if (!verificacao) return { success: true };
      if (verificacao.janelaId !== evento.sender.id || verificacao.usuarioId !== usuarioId) throw new Error('A verificação não pertence à sessão atual.');
      verificacao.controlador.abort();
      return { success: true };
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:preparar-visualizacao', async (evento, copiaId: unknown) => { try { if (typeof copiaId !== 'string') throw new Error('Cópia inválida.'); observar(evento); const cache = await obterPacote(evento, copiaId); await googleDriveService.registrarVerificacaoConcluida(cache.usuarioId, cache.revisao); return { success: true, data: { cacheId: cache.id, ...htmlVisualizacao(cache.pacote), titulo: `Laudo — REP ${cache.pacote.rep.numero}` } }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:analisar-restauracao', async (evento, copiaId: unknown) => { try { if (typeof copiaId !== 'string') throw new Error('Cópia inválida.'); observar(evento); const cache = await obterPacote(evento, copiaId); const conflitos = await analisarConflitosBkp(cache.pacote); const operacaoId = randomUUID(); restauracoes.set(operacaoId, { janelaId: evento.sender.id, usuarioId: cache.usuarioId, copiaId, revisao: cache.revisao, identidadeCaso: conflitos.identidade, cacheId: cache.id, expiraEm: cache.expiraEm }); return { success: true, data: { operacaoId, previa: conflitos.previa, copiaId, revisao: cache.revisao } }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:confirmar-restauracao', async (evento, operacaoId: unknown, confirmarSubstituicao: unknown) => { try { if (typeof confirmarSubstituicao !== 'boolean') throw new Error('Confirmação inválida.'); const operacao = obterRestauracao(evento, operacaoId); const cache = pacotes.get(operacao.cacheId); if (!cache || cache.expiraEm < Date.now()) throw new Error('O pacote temporário expirou. Selecione a cópia novamente.'); await googleDriveService.conferirCopiaAtual(operacao.usuarioId, operacao.copiaId, operacao.revisao); const laudoId = await importarBkpLaudo(cache.pacote, path.join(cache.diretorio, 'conteudo'), operacao.usuarioId, operacao.identidadeCaso, confirmarSubstituicao); restauracoes.delete(String(operacaoId)); return { success: true, data: { laudoId } }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:cancelar-restauracao', (evento, operacaoId: unknown) => { try { const operacao = obterRestauracao(evento, operacaoId); restauracoes.delete(String(operacaoId)); return { success: true, data: operacao.copiaId }; } catch (erro) { return respostaErro(erro); } });
  ipcMain.handle('google-drive:mover-para-lixeira', async (evento, copiaId: unknown, revisao: unknown) => { try { if (typeof copiaId !== 'string' || typeof revisao !== 'string') throw new Error('Cópia inválida.'); const usuarioId = usuario(evento); await googleDriveService.moverParaLixeira(usuarioId, copiaId, revisao); await Promise.all(Array.from(pacotes.values()).filter(item => item.copiaId === copiaId && item.usuarioId === usuarioId).map(item => descartarPacote(item.id))); return { success: true }; } catch (erro) { return respostaErro(erro); } });
}
