import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain } from 'electron';
import { authSessaoService } from '../../main/services/auth-sessao.service';
import { importarBkpLaudo, lerBkpLaudo, analisarConflitosBkp } from '../../main/services/laudo-bkp.service';

vi.mock('../../main/database/sqlite', () => ({ executeQuery: vi.fn(async () => [{ numero: '2022/00039259' }]) }));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(), getVersion: vi.fn(() => '1') },
  BrowserWindow: { fromWebContents: vi.fn(() => ({ isDestroyed: () => false })) },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));
vi.mock('../../main/services/auth-sessao.service', () => ({ authSessaoService: { exigir: vi.fn(() => 'usuario') } }));
vi.mock('../../main/services/laudo-bkp.service', () => ({
  exportarBkpLaudo: vi.fn(), importarBkpLaudo: vi.fn(async () => 'laudo'), lerBkpLaudo: vi.fn(async () => ({})),
  analisarConflitosBkp: vi.fn(async () => ({ identidade: 'estado', previa: { numeroRep: '1', substituiRep: false } })),
}));
let diretorio = '';
let arquivo = '';
const evento = (id = 1) => ({ sender: { id, once: vi.fn() } }) as unknown as Electron.IpcMainInvokeEvent;
async function chamar(nome: string, remetente: Electron.IpcMainInvokeEvent, ...args: unknown[]) {
  const handler = vi.mocked(ipcMain.handle).mock.calls.find(([canal]) => canal === `laudo:${nome}`)?.[1];
  if (!handler) throw new Error('Handler não registrado.');
  return handler(remetente, ...args);
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(authSessaoService.exigir).mockImplementation(() => 'usuario');
  diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-bkp-ipc-'));
  arquivo = path.join(diretorio, 'caso.bkp');
  await writeFile(arquivo, 'conteudo');
  vi.mocked(app.getPath).mockReturnValue(diretorio);
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [arquivo] });
  const { registrarLaudoBkpHandlers } = await import('../../main/ipc/handlers/laudo-bkp.handlers');
  registrarLaudoBkpHandlers();
});
afterEach(async () => { await rm(diretorio, { recursive: true, force: true }); });

async function preparar(remetente = evento()) {
  const selecao = await chamar('selecionarBkp', remetente);
  const analise = await chamar('analisarBkp', remetente, selecao.data.selecaoId);
  return { remetente, operacaoId: analise.data.operacaoId };
}

describe('fronteira IPC do BKP de laudo', () => {
  it('sugere o nome de arquivo pelo número do laudo em vez do UUID', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' });
    expect(await chamar('exportarBkp', evento(), '4a58c57a-f3be-4247-90c0-ebba386d178d')).toMatchObject({ canceled: true });
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ defaultPath: 'laudo-39259-22.bkp' }));
  });
  it('exige autenticação antes de abrir o seletor', async () => {
    vi.mocked(authSessaoService.exigir).mockImplementation(() => { throw new Error('Sessão ausente.'); });
    expect(await chamar('selecionarBkp', evento())).toMatchObject({ success: false, error: 'Sessão ausente.' });
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });
  it('vincula a prévia à janela e impede reutilizar a confirmação', async () => {
    const { remetente, operacaoId } = await preparar();
    expect(await chamar('importarBkp', evento(2), operacaoId, true)).toMatchObject({ success: false });
    expect(importarBkpLaudo).not.toHaveBeenCalled();
    expect(await chamar('importarBkp', remetente, operacaoId, true)).toMatchObject({ success: true, data: { laudoId: 'laudo' } });
    expect(await chamar('importarBkp', remetente, operacaoId, true)).toMatchObject({ success: false });
    expect(importarBkpLaudo).toHaveBeenCalledTimes(1);
  });
  it('recusa arquivo alterado depois da análise', async () => {
    const { remetente, operacaoId } = await preparar();
    await writeFile(arquivo, 'conteudo alterado');
    expect(await chamar('importarBkp', remetente, operacaoId, true)).toMatchObject({ success: false, error: expect.stringContaining('alterado') });
    expect(importarBkpLaudo).not.toHaveBeenCalled();
  });
  it('expira a prévia após cinco minutos', async () => {
    const { remetente, operacaoId } = await preparar();
    const agora = Date.now();
    vi.mocked(Date.now).mockReturnValueOnce(agora + 300001).mockReturnValueOnce(agora + 300001);
    expect(await chamar('importarBkp', remetente, operacaoId, true)).toMatchObject({ success: false });
    expect(importarBkpLaudo).not.toHaveBeenCalled();
  });
  it('permite cancelar sem importar e não expõe o caminho completo ao renderer', async () => {
    const remetente = evento();
    const selecao = await chamar('selecionarBkp', remetente);
    expect(JSON.stringify(selecao)).not.toContain(diretorio.replaceAll('\\', '\\\\'));
    await chamar('cancelarBkp', remetente, selecao.data.selecaoId);
    expect(await chamar('analisarBkp', remetente, selecao.data.selecaoId)).toMatchObject({ success: false });
    expect(lerBkpLaudo).not.toHaveBeenCalled();
    expect(analisarConflitosBkp).not.toHaveBeenCalled();
  });
});
