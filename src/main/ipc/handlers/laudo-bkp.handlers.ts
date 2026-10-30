import { executeQuery } from '../../database/sqlite.js';
import { obterIdentificacaoBkpLaudo } from '../../../shared/utils/nomes-documentos-rep.js';
import { getLogger } from '../../utils/logger.js';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { authSessaoService } from '../../services/auth-sessao.service.js';
import { analisarConflitosBkp, exportarBkpLaudo, importarBkpLaudo, lerBkpLaudo } from '../../services/laudo-bkp.service.js';

interface Selecao { janelaId: number; usuarioId: string; caminho: string; expiraEm: number }
interface Preparacao extends Selecao { hash: string; identidadeCaso: string }
const selecoes = new Map<string, Selecao>();
const preparacoes = new Map<string, Preparacao>();
let operacaoAtiva = false;
const janelasObservadas = new WeakSet<Electron.WebContents>();
async function limparTemporario(diretorio: string) {
  await rm(diretorio, { recursive: true, force: true }).catch(erro => getLogger('laudo').warn('Falha ao remover área temporária do BKP.', { erro: erro instanceof Error ? erro.message : 'Erro inesperado' }));
}

async function hashArquivo(caminho: string): Promise<string> {
  const info = await stat(caminho);
  if (!info.isFile() || info.size > 20 * 1024 * 1024 * 1024) throw new Error('Tamanho de BKP inválido.');
  const hash = createHash('sha256');
  for await (const parte of createReadStream(caminho)) hash.update(parte);
  return hash.digest('hex');
}
function autenticar(evento: Electron.IpcMainInvokeEvent) {
  const usuarioId = authSessaoService.exigir(evento.sender.id);
  const janela = BrowserWindow.fromWebContents(evento.sender);
  if (!janela || janela.isDestroyed()) throw new Error('Janela indisponível.');
  for (const [id, selecao] of selecoes) if (selecao.expiraEm < Date.now()) selecoes.delete(id);
  for (const [id, preparacao] of preparacoes) if (preparacao.expiraEm < Date.now()) preparacoes.delete(id);
  return { usuarioId, janela };
}
function erroResposta(erro: unknown) { return { success: false, error: erro instanceof Error ? erro.message : 'Erro inesperado no BKP do laudo.' }; }
function obterOperacao<T extends Selecao>(mapa: Map<string, T>, id: unknown, janelaId: number, usuarioId: string): T {
  const operacao = typeof id === 'string' ? mapa.get(id) : undefined;
  if (!operacao || operacao.janelaId !== janelaId || operacao.usuarioId !== usuarioId || operacao.expiraEm < Date.now()) throw new Error('Seleção ou prévia expirada. Escolha o arquivo novamente.');
  return operacao;
}
function limparJanela(janelaId: number) {
  for (const [id, selecao] of selecoes) if (selecao.janelaId === janelaId) selecoes.delete(id);
  for (const [id, preparacao] of preparacoes) if (preparacao.janelaId === janelaId) preparacoes.delete(id);
}

export function registrarLaudoBkpHandlers(): void {
  ipcMain.handle('laudo:exportarBkp', async (evento, laudoId: unknown) => {
    let iniciou = false;
    try {
      const { janela, usuarioId } = autenticar(evento);
      if (typeof laudoId !== 'string' || !/^[\w-]+$/.test(laudoId)) throw new Error('Laudo inválido.');
      if (operacaoAtiva) throw new Error('Aguarde a operação de BKP em andamento.');
      operacaoAtiva = true; iniciou = true;
      const [rep] = await executeQuery<{ numero: unknown }>('SELECT r.numero FROM laudos l JOIN reps r ON r.id = l.rep_id WHERE l.id = ?', [laudoId]);
      if (!rep || typeof rep.numero !== 'string' || !rep.numero.trim()) throw new Error('Número da REP do laudo não encontrado.');
      const { nomeArquivo } = obterIdentificacaoBkpLaudo(rep.numero);
      const destino = await dialog.showSaveDialog(janela, { title: 'Exportar BKP do laudo', defaultPath: nomeArquivo, filters: [{ name: 'BKP de um laudo', extensions: ['bkp'] }] });
      if (destino.canceled || !destino.filePath) return { success: false, canceled: true };
      if (authSessaoService.exigir(evento.sender.id) !== usuarioId) throw new Error('A sessão foi alterada.');
      await exportarBkpLaudo(laudoId, destino.filePath);
      return { success: true };
    } catch (erro) { return erroResposta(erro); }
    finally { if (iniciou) operacaoAtiva = false; }
  });
  ipcMain.handle('laudo:selecionarBkp', async evento => {
    try {
      const { janela, usuarioId } = autenticar(evento);
      const arquivo = await dialog.showOpenDialog(janela, { title: 'Importar BKP de um laudo', properties: ['openFile'], filters: [{ name: 'BKP de um laudo', extensions: ['bkp'] }] });
      if (arquivo.canceled || !arquivo.filePaths.length) return { success: false, canceled: true };
      if (authSessaoService.exigir(evento.sender.id) !== usuarioId) throw new Error('A sessão foi alterada.');
      limparJanela(evento.sender.id);
      if (!janelasObservadas.has(evento.sender)) {
        janelasObservadas.add(evento.sender);
        evento.sender.once('destroyed', () => limparJanela(evento.sender.id));
      }
      const selecaoId = randomUUID();
      selecoes.set(selecaoId, { janelaId: evento.sender.id, usuarioId, caminho: arquivo.filePaths[0], expiraEm: Date.now() + 600000 });
      return { success: true, data: { selecaoId, nomeArquivo: path.basename(arquivo.filePaths[0]) } };
    } catch (erro) { return erroResposta(erro); }
  });
  ipcMain.handle('laudo:analisarBkp', async (evento, selecaoId: unknown) => {
    let temporario: string | undefined;
    let iniciou = false;
    try {
      const { usuarioId } = autenticar(evento);
      const selecao = obterOperacao(selecoes, selecaoId, evento.sender.id, usuarioId);
      if (operacaoAtiva) throw new Error('Aguarde a operação de BKP em andamento.');
      operacaoAtiva = true; iniciou = true;
      temporario = await mkdtemp(path.join(app.getPath('userData'), 'laudo-bkp-'));
      const hash = await hashArquivo(selecao.caminho);
      const pacote = await lerBkpLaudo(selecao.caminho, path.join(temporario, 'conteudo'));
      if (await hashArquivo(selecao.caminho) !== hash) throw new Error('O arquivo foi alterado durante a análise.');
      if (authSessaoService.exigir(evento.sender.id) !== usuarioId) throw new Error('A sessão foi alterada.');
      const conflitos = await analisarConflitosBkp(pacote);
      const operacaoId = randomUUID();
      preparacoes.set(operacaoId, { ...selecao, hash, identidadeCaso: conflitos.identidade, expiraEm: Date.now() + 300000 });
      selecoes.delete(String(selecaoId));
      return { success: true, data: { operacaoId, previa: conflitos.previa } };
    } catch (erro) { return erroResposta(erro); }
    finally { if (temporario) await limparTemporario(temporario); if (iniciou) operacaoAtiva = false; }
  });
  ipcMain.handle('laudo:importarBkp', async (evento, operacaoId: unknown, confirmar: unknown) => {
    let temporario: string | undefined;
    let iniciou = false;
    try {
      const { usuarioId } = autenticar(evento);
      const preparacao = obterOperacao(preparacoes, operacaoId, evento.sender.id, usuarioId);
      if (typeof confirmar !== 'boolean') throw new Error('Confirmação inválida.');
      if (operacaoAtiva) throw new Error('Aguarde a operação de BKP em andamento.');
      operacaoAtiva = true; iniciou = true;
      preparacoes.delete(String(operacaoId));
      if (await hashArquivo(preparacao.caminho) !== preparacao.hash) throw new Error('O arquivo foi alterado após a prévia.');
      temporario = await mkdtemp(path.join(app.getPath('userData'), 'laudo-bkp-'));
      const conteudo = path.join(temporario, 'conteudo');
      const pacote = await lerBkpLaudo(preparacao.caminho, conteudo);
      if (await hashArquivo(preparacao.caminho) !== preparacao.hash) throw new Error('O arquivo foi alterado após a prévia.');
      if (authSessaoService.exigir(evento.sender.id) !== usuarioId) throw new Error('A sessão foi alterada.');
      const laudoId = await importarBkpLaudo(pacote, conteudo, usuarioId, preparacao.identidadeCaso, confirmar);
      return { success: true, data: { laudoId } };
    } catch (erro) { return erroResposta(erro); }
    finally { if (temporario) await limparTemporario(temporario); if (iniciou) operacaoAtiva = false; }
  });
  ipcMain.handle('laudo:cancelarBkp', (evento, id: unknown) => {
    try {
      const { usuarioId } = autenticar(evento);
      for (const mapa of [selecoes, preparacoes]) {
        const item = typeof id === 'string' ? mapa.get(id) : undefined;
        if (item && item.janelaId === evento.sender.id && item.usuarioId === usuarioId) mapa.delete(String(id));
      }
      return { success: true };
    } catch (erro) { return erroResposta(erro); }
  });
}
