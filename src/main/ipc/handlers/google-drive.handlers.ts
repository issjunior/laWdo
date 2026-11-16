import { app, BrowserWindow, ipcMain } from 'electron';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { authSessaoService } from '../../services/auth-sessao.service.js';
import { ErroGoogleDrive, googleDriveService } from '../../services/google-drive.service.js';
import { analisarConflitosBkp, importarBkpLaudo } from '../../services/laudo-bkp.service.js';

interface RestauracaoPreparada {
  janelaId: number;
  usuarioId: string;
  copiaId: string;
  revisao: string;
  hashCifrado: string;
  identidadeCaso: string;
  expiraEm: number;
}

const restauracoes = new Map<string, RestauracaoPreparada>();

function respostaErro(erro: unknown) {
  return {
    success: false,
    error: erro instanceof Error ? erro.message : 'Erro inesperado na integração com o Google Drive.',
    diagnostico: erro instanceof ErroGoogleDrive ? { etapa: erro.etapa, codigo: erro.codigo } : { etapa: 'desconhecida', codigo: 'erro_inesperado' },
  };
}

function usuario(evento: Electron.IpcMainInvokeEvent) {
  return authSessaoService.exigir(evento.sender.id);
}

function obterRestauracao(evento: Electron.IpcMainInvokeEvent, operacaoId: unknown): RestauracaoPreparada {
  const usuarioId = usuario(evento);
  const operacao = typeof operacaoId === 'string' ? restauracoes.get(operacaoId) : undefined;
  if (!operacao || operacao.janelaId !== evento.sender.id || operacao.usuarioId !== usuarioId || operacao.expiraEm < Date.now()) throw new Error('A prévia de restauração expirou. Analise a cópia novamente.');
  return operacao;
}

async function limparTemporario(diretorio: string) { await rm(diretorio, { recursive: true, force: true }).catch(() => undefined); }

export function registrarGoogleDriveHandlers(): void {
  const janelasObservadas = new WeakSet<Electron.WebContents>();
  const observarJanela = (conteudo: Electron.WebContents) => {
    if (janelasObservadas.has(conteudo)) return;
    janelasObservadas.add(conteudo);
    conteudo.once('destroyed', () => {
      for (const [id, operacao] of restauracoes) if (operacao.janelaId === conteudo.id) restauracoes.delete(id);
    });
  };
  ipcMain.handle('google-drive:estado-rapido', async evento => {
    try { return { success: true, data: await googleDriveService.estadoRapido(usuario(evento)) }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:estado', async evento => {
    try { return { success: true, data: await googleDriveService.estado(usuario(evento)) }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:resumo', async (evento, forcarAtualizacao: unknown) => {
    try {
      if (forcarAtualizacao !== undefined && typeof forcarAtualizacao !== 'boolean') throw new Error('Atualização inválida.');
      return { success: true, data: await googleDriveService.resumo(usuario(evento), forcarAtualizacao === true) };
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:conectar', async evento => {
    try { return { success: true, data: await googleDriveService.conectar(usuario(evento)) }; } catch (erro) {
      const resposta = respostaErro(erro);
      if (erro instanceof ErroGoogleDrive && erro.etapa === 'renovar_token') {
        return { ...resposta, error: 'Não foi possível concluir a conexão com o Google Drive. Tente conectar a conta novamente.' };
      }
      return resposta;
    }
  });
  ipcMain.handle('google-drive:desconectar', async evento => {
    try { await googleDriveService.desconectar(usuario(evento)); return { success: true }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:definir-envio-automatico', async (evento, ativo: unknown) => {
    try {
      if (typeof ativo !== 'boolean') throw new Error('Configuração inválida.');
      return { success: true, data: await googleDriveService.definirEnvioAutomatico(usuario(evento), ativo) };
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:listar-copias', async evento => {
    try { return { success: true, data: await googleDriveService.listarCopias(usuario(evento)) }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:listar-laudos-concluidos', async evento => {
    try { return { success: true, data: await googleDriveService.listarLaudosConcluidos(usuario(evento)) }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:enviar-laudo', async (evento, laudoId: unknown, confirmarSubstituicao: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof confirmarSubstituicao !== 'boolean') throw new Error('Dados de envio inválidos.');
      return { success: true, data: await googleDriveService.enviarLaudo(usuario(evento), laudoId, confirmarSubstituicao) };
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:verificar', async (evento, copiaId: unknown) => {
    try {
      if (typeof copiaId !== 'string') throw new Error('Cópia inválida.');
      return { success: true, data: await googleDriveService.verificar(usuario(evento), copiaId) };
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('google-drive:analisar-restauracao', async (evento, copiaId: unknown) => {
    let temporario: string | undefined;
    try {
      const usuarioId = usuario(evento);
      if (typeof copiaId !== 'string') throw new Error('Cópia inválida.');
      temporario = await mkdtemp(path.join(app.getPath('userData'), 'google-drive-restauracao-'));
      const lido = await googleDriveService.lerPacoteCopia(usuarioId, copiaId, temporario);
      const conflitos = await analisarConflitosBkp(lido.pacote);
      const janela = BrowserWindow.fromWebContents(evento.sender);
      if (!janela || janela.isDestroyed()) throw new Error('Janela indisponível.');
      observarJanela(evento.sender);
      const operacaoId = randomUUID();
      restauracoes.set(operacaoId, { janelaId: evento.sender.id, usuarioId, copiaId, revisao: lido.revisao, hashCifrado: lido.hashCifrado, identidadeCaso: conflitos.identidade, expiraEm: Date.now() + 300_000 });
      return { success: true, data: { operacaoId, previa: conflitos.previa, copiaId, revisao: lido.revisao } };
    } catch (erro) { return respostaErro(erro); }
    finally { if (temporario) await limparTemporario(temporario); }
  });
  ipcMain.handle('google-drive:confirmar-restauracao', async (evento, operacaoId: unknown, confirmarSubstituicao: unknown) => {
    let temporario: string | undefined;
    try {
      if (typeof confirmarSubstituicao !== 'boolean') throw new Error('Confirmação inválida.');
      const operacao = obterRestauracao(evento, operacaoId);
      restauracoes.delete(String(operacaoId));
      temporario = await mkdtemp(path.join(app.getPath('userData'), 'google-drive-restauracao-'));
      const lido = await googleDriveService.lerPacoteCopia(operacao.usuarioId, operacao.copiaId, temporario);
      if (lido.revisao !== operacao.revisao || lido.hashCifrado !== operacao.hashCifrado) throw new Error('A cópia foi alterada após a prévia. Analise-a novamente.');
      if (usuario(evento) !== operacao.usuarioId) throw new Error('A sessão foi alterada.');
      const laudoId = await importarBkpLaudo(lido.pacote, path.join(temporario, 'conteudo'), operacao.usuarioId, operacao.identidadeCaso, confirmarSubstituicao);
      return { success: true, data: { laudoId } };
    } catch (erro) { return respostaErro(erro); }
    finally { if (temporario) await limparTemporario(temporario); }
  });
  ipcMain.handle('google-drive:cancelar-restauracao', (evento, operacaoId: unknown) => {
    try {
      const operacao = obterRestauracao(evento, operacaoId);
      restauracoes.delete(String(operacaoId));
      return { success: true, data: operacao.copiaId };
    } catch (erro) { return respostaErro(erro); }
  });
}
