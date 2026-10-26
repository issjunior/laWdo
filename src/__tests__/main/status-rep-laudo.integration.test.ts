import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app, ipcMain } from 'electron';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('status local da REP vinculada ao laudo', () => {
  let diretorio: string;
  let banco: typeof import('../../main/database/index');
  let sqlite: typeof import('../../main/database/sqlite');
  let laudos: typeof import('../../main/services/laudo.service')['laudoService'];

  const statusRep = async (id: string) => {
    const linhas = await sqlite.executeQuery<{ status: string }>('SELECT status FROM reps WHERE id = ?', [id]);
    return linhas[0]?.status;
  };

  const criarRep = async (id: string) => {
    await sqlite.executeNonQuery('INSERT INTO reps (id, numero, data_requisicao) VALUES (?, ?, ?)', [id, id, '2026-10-26']);
  };

  beforeAll(async () => {
    diretorio = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-status-rep-laudo-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    vi.resetModules();
    banco = await import('../../main/database/index');
    sqlite = await import('../../main/database/sqlite');
    await banco.setupDatabase();
    laudos = (await import('../../main/services/laudo.service')).laudoService;
    await sqlite.executeNonQuery("INSERT INTO users (id, nome, email, username, senha_hash) VALUES ('perito', 'Perito', 'perito@teste.local', 'perito', 'hash')");
    await sqlite.executeNonQuery("INSERT INTO templates (id, nome) VALUES ('template', 'Template de teste')");
  });

  afterAll(async () => {
    await sqlite?.closeDatabase();
    if (diretorio) await fs.rm(diretorio, { recursive: true, force: true });
  });

  it('acompanha criação, conclusão, entrega, reabertura e exclusão', async () => {
    await criarRep('rep-ciclo');
    expect(await statusRep('rep-ciclo')).toBe('Pendente');
    const laudo = await laudos.criarLaudoInicial({ rep_id: 'rep-ciclo', perito_id: 'perito', template_id: 'template' });
    expect(await statusRep('rep-ciclo')).toBe('Em Andamento');

    const { registerLaudoHandlers } = await import('../../main/ipc/handlers/laudo.handlers');
    registerLaudoHandlers();
    const obterHandler = (canal: string) => {
      const handler = vi.mocked(ipcMain.handle).mock.calls.find(([nome]) => nome === canal)?.[1];
      if (!handler) throw new Error(`Handler ${canal} não registrado`);
      return handler;
    };
    const atualizar = obterHandler('laudo:updateStatus');
    const excluir = obterHandler('laudo:delete');

    expect((await atualizar({} as Electron.IpcMainInvokeEvent, laudo.id, 'Concluído')).success).toBe(true);
    expect(await statusRep('rep-ciclo')).toBe('Concluído');
    expect((await atualizar({} as Electron.IpcMainInvokeEvent, laudo.id, 'Entregue')).success).toBe(true);
    expect(await statusRep('rep-ciclo')).toBe('Concluído');
    expect((await atualizar({} as Electron.IpcMainInvokeEvent, laudo.id, 'Em andamento')).success).toBe(true);
    expect(await statusRep('rep-ciclo')).toBe('Em Andamento');
    const repService = (await import('../../main/services/rep.service')).repService;
    const falhaRep = vi.spyOn(repService, 'updateStatus').mockResolvedValueOnce(null);
    expect((await atualizar({} as Electron.IpcMainInvokeEvent, laudo.id, 'Concluído')).success).toBe(false);
    expect(await laudos.findById(laudo.id)).toMatchObject({ status: 'Em andamento' });
    expect(await statusRep('rep-ciclo')).toBe('Em Andamento');
    falhaRep.mockRestore();
    expect((await excluir({} as Electron.IpcMainInvokeEvent, laudo.id)).success).toBe(true);
    expect(await statusRep('rep-ciclo')).toBe('Pendente');
  });

  it('corrige REPs legadas vinculadas e preserva a REP sem laudo', async () => {
    for (const id of ['rep-andamento', 'rep-concluida', 'rep-entregue', 'rep-sem-laudo']) await criarRep(id);
    const emAndamento = await laudos.criarLaudoInicial({ rep_id: 'rep-andamento', perito_id: 'perito', template_id: 'template' });
    const concluido = await laudos.criarLaudoInicial({ rep_id: 'rep-concluida', perito_id: 'perito', template_id: 'template' });
    const entregue = await laudos.criarLaudoInicial({ rep_id: 'rep-entregue', perito_id: 'perito', template_id: 'template' });
    await laudos.updateStatus(concluido.id, 'Concluído');
    await laudos.updateStatus(entregue.id, 'Entregue');
    await sqlite.executeNonQuery("UPDATE reps SET status = 'Pendente' WHERE id IN ('rep-andamento', 'rep-concluida', 'rep-entregue')");
    await sqlite.executeNonQuery('DELETE FROM schema_version');
    await sqlite.executeNonQuery('INSERT INTO schema_version (version) VALUES (46)');
    await sqlite.closeDatabase();

    await banco.setupDatabase();
    expect(await banco.getSchemaVersion()).toBe(48);
    expect(await laudos.findById(emAndamento.id)).toMatchObject({ status: 'Em andamento' });
    expect(await statusRep('rep-andamento')).toBe('Em Andamento');
    expect(await statusRep('rep-concluida')).toBe('Concluído');
    expect(await statusRep('rep-entregue')).toBe('Concluído');
    expect(await statusRep('rep-sem-laudo')).toBe('Pendente');
  });
});
