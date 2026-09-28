import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdtemp, open, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { authSessaoService } from '../../services/auth-sessao.service.js';
import { criarBackup, previaBackupCompleto, restaurarBackupExtraido } from '../../services/backup.service.js';
import { exportarConfig, previaConfiguracao, restaurarConfig } from '../../services/config-backup.service.js';
import { extrairArquivoBackup, type TipoBackup } from '../../services/backup-arquivo.service.js';
import { auditBackup, auditExport } from '../../services/audit-log.service.js';

interface Preparacao {
  janelaId: number;
  caminho: string;
  tipo: TipoBackup;
  tamanho: number;
  modificadoEm: number;
  identidade: string;
  expiraEm: number;
}

const preparacoes = new Map<string, Preparacao>();

function janelaAutenticada(evento: Electron.IpcMainInvokeEvent): BrowserWindow {
  authSessaoService.exigir(evento.sender.id);
  const janela = BrowserWindow.fromWebContents(evento.sender);
  if (!janela || janela.isDestroyed()) throw new Error('Janela indisponível.');
  return janela;
}

function erroResposta(erro: unknown): { success: false; error: string } {
  return { success: false, error: erro instanceof Error ? erro.message : 'Erro inesperado no backup.' };
}

function tipoValido(tipo: unknown): tipo is TipoBackup {
  return tipo === 'completo' || tipo === 'configuracao';
}

async function identidadeArquivo(caminho: string, tamanho: number): Promise<string> {
  const arquivo = await open(caminho, 'r');
  try {
    const inicio = Buffer.alloc(40);
    const final = Buffer.alloc(16);
    await arquivo.read(inicio, 0, inicio.length, 0);
    await arquivo.read(final, 0, final.length, tamanho - final.length);
    return `${inicio.toString('hex')}:${final.toString('hex')}`;
  } finally {
    await arquivo.close();
  }
}

export const registerBackupHandlers = (): void => {
  ipcMain.handle('backup:criar', async (evento, tipo: unknown, senha: unknown) => {
    try {
      const janela = janelaAutenticada(evento);
      if (!tipoValido(tipo) || typeof senha !== 'string') throw new Error('Parâmetros do backup inválidos.');
      const selecionado = await dialog.showSaveDialog(janela, {
        title: tipo === 'completo' ? 'Salvar backup completo' : 'Salvar backup de configuração',
        defaultPath: `lawdo_${tipo}_${new Date().toISOString().slice(0, 10)}.lawdo-backup`,
        filters: [{ name: 'Backup protegido laWdo', extensions: ['lawdo-backup'] }],
      });
      if (selecionado.canceled || !selecionado.filePath) return { success: false, canceled: true };
      const resultado = tipo === 'completo'
        ? await criarBackup(selecionado.filePath, senha)
        : await exportarConfig(selecionado.filePath, senha);
      if (resultado.success) {
        if (tipo === 'completo') auditBackup('', 'criar', selecionado.filePath);
        else auditExport('', 'Configuração do sistema', selecionado.filePath);
      }
      return resultado;
    } catch (erro) {
      return erroResposta(erro);
    }
  });

  ipcMain.handle('backup:analisar', async (evento, tipo: unknown, senha: unknown) => {
    let diretorio: string | null = null;
    try {
      const janela = janelaAutenticada(evento);
      if (!tipoValido(tipo) || typeof senha !== 'string') throw new Error('Parâmetros do backup inválidos.');
      const selecionado = await dialog.showOpenDialog(janela, {
        title: tipo === 'completo' ? 'Selecionar backup completo' : 'Selecionar backup de configuração',
        filters: [{ name: 'Backup protegido laWdo', extensions: ['lawdo-backup'] }],
        properties: ['openFile'],
      });
      if (selecionado.canceled || selecionado.filePaths.length === 0) return { success: false, canceled: true };
      diretorio = await mkdtemp(path.join(app.getPath('userData'), 'lawdo-prever-backup-'));
      const caminho = selecionado.filePaths[0];
      const manifesto = await extrairArquivoBackup(caminho, senha, diretorio);
      if (manifesto.tipo !== tipo) throw new Error('Modalidade do backup diferente da selecionada.');
      const previa = tipo === 'completo'
        ? await previaBackupCompleto(diretorio, manifesto)
        : await previaConfiguracao(diretorio, manifesto);
      const info = await stat(caminho);
      const operacaoId = randomUUID();
      preparacoes.set(operacaoId, {
        janelaId: evento.sender.id, caminho, tipo, tamanho: info.size,
        modificadoEm: info.mtimeMs, identidade: await identidadeArquivo(caminho, info.size),
        expiraEm: Date.now() + 5 * 60_000,
      });
      return { success: true, operacaoId, previa };
    } catch (erro) {
      return erroResposta(erro);
    } finally {
      if (diretorio) await rm(diretorio, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  ipcMain.handle('backup:confirmar', async (evento, operacaoId: unknown, senha: unknown) => {
    let diretorio: string | null = null;
    try {
      janelaAutenticada(evento);
      if (typeof operacaoId !== 'string' || typeof senha !== 'string') throw new Error('Confirmação inválida.');
      const preparacao = preparacoes.get(operacaoId);
      preparacoes.delete(operacaoId);
      if (!preparacao || preparacao.janelaId !== evento.sender.id || preparacao.expiraEm < Date.now()) {
        throw new Error('Prévia expirada. Selecione o arquivo novamente.');
      }
      const info = await stat(preparacao.caminho);
      if (info.size !== preparacao.tamanho || info.mtimeMs !== preparacao.modificadoEm
        || await identidadeArquivo(preparacao.caminho, info.size) !== preparacao.identidade) {
        throw new Error('O arquivo foi alterado depois da prévia.');
      }
      diretorio = await mkdtemp(path.join(app.getPath('userData'), 'lawdo-restaurar-backup-'));
      const manifesto = await extrairArquivoBackup(preparacao.caminho, senha, diretorio);
      if (manifesto.tipo !== preparacao.tipo) throw new Error('Modalidade do backup inválida.');
      if (preparacao.tipo === 'completo') {
        await restaurarBackupExtraido(diretorio, manifesto);
        auditBackup('', 'restaurar', preparacao.caminho);
        setTimeout(() => { app.relaunch(); app.exit(0); }, 1000);
      } else {
        await restaurarConfig(diretorio, manifesto);
        auditExport('', 'Importação de configuração', preparacao.caminho);
      }
      return { success: true, reinicio: preparacao.tipo === 'completo' };
    } catch (erro) {
      return erroResposta(erro);
    } finally {
      if (diretorio) await rm(diretorio, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  ipcMain.handle('backup:cancelar', (evento, operacaoId: unknown) => {
    try {
      janelaAutenticada(evento);
      if (typeof operacaoId === 'string' && preparacoes.get(operacaoId)?.janelaId === evento.sender.id) preparacoes.delete(operacaoId);
      return { success: true };
    } catch (erro) {
      return erroResposta(erro);
    }
  });
};
