import { ipcMain } from 'electron';
import { projetilService } from '../../services/projetil.service.js';

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Erro inesperado.';
}

export function registerProjetilHandlers(): void {
  ipcMain.handle('projetil:listarPersonalizados', async () => {
    try { return { success: true, data: await projetilService.listar() }; }
    catch (erro) { return { success: false, error: mensagem(erro) }; }
  });
  ipcMain.handle('projetil:salvarPersonalizado', async (_evento, dados: unknown, id?: unknown) => {
    try {
      if (id !== undefined && (typeof id !== 'string' || !id.trim())) throw new Error('Identificador inválido.');
      return { success: true, data: await projetilService.salvar(dados, id as string | undefined) };
    } catch (erro) { return { success: false, error: mensagem(erro) }; }
  });
  ipcMain.handle('projetil:excluirPersonalizado', async (_evento, id: unknown) => {
    try {
      if (typeof id !== 'string' || !id.trim()) throw new Error('Identificador inválido.');
      await projetilService.excluir(id);
      return { success: true };
    } catch (erro) { return { success: false, error: mensagem(erro) }; }
  });
  ipcMain.handle('projetil:importarCsv', async (_evento, texto: unknown) => {
    try {
      if (typeof texto !== 'string') throw new Error('CSV inválido.');
      return { success: true, data: await projetilService.importarCsv(texto) };
    } catch (erro) { return { success: false, error: mensagem(erro) }; }
  });
}
