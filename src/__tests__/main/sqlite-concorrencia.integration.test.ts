import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const ambiente = vi.hoisted(() => ({ diretorio: '' }));
vi.mock('electron', () => ({ app: { getPath: () => ambiente.diretorio } }));
vi.mock('../../main/utils/logger.js', () => ({ getLogger: () => ({ error: vi.fn() }) }));
let banco: typeof import('../../main/database/sqlite');
function barreira() {
  let liberar!: () => void;
  const promessa = new Promise<void>(resolve => { liberar = resolve; });
  return { promessa, liberar };
}
beforeAll(async () => {
  ambiente.diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-fila-sqlite-'));
  banco = await import('../../main/database/sqlite');
  await Promise.all([
    banco.executeNonQuery('CREATE TABLE itens (id TEXT PRIMARY KEY)'),
    banco.executeQuery('PRAGMA foreign_keys'),
  ]);
});
beforeEach(async () => { await banco.executeNonQuery('DELETE FROM itens'); });
afterAll(async () => { await banco?.closeDatabase(); await rm(ambiente.diretorio, { recursive: true, force: true }); });

it('aguarda commit antes de iniciar outra transação ou operação externa', async () => {
  const iniciou = barreira(); const continuar = barreira();
  const ordem: string[] = [];
  const primeira = banco.withTransaction(async () => {
    await banco.executeNonQuery("INSERT INTO itens VALUES ('primeira')");
    iniciou.liberar(); await continuar.promessa;
    ordem.push('primeira');
  });
  await iniciou.promessa;
  const segunda = banco.withTransaction(async () => {
    ordem.push('segunda');
    expect(await banco.executeQuery('SELECT id FROM itens')).toEqual([{ id: 'primeira' }]);
    await banco.executeNonQuery("INSERT INTO itens VALUES ('segunda')");
  });
  const externa = banco.executeQuery('SELECT id FROM itens ORDER BY id');
  expect(ordem).toEqual([]);
  continuar.liberar();
  await Promise.all([primeira, segunda]);
  expect(await externa).toEqual([{ id: 'primeira' }, { id: 'segunda' }]);
  expect(ordem).toEqual(['primeira', 'segunda']);
});

it('não inclui a escrita externa no rollback e libera a fila após falha', async () => {
  const iniciou = barreira(); const continuar = barreira();
  const erro = new Error('falha original');
  const transacao = banco.withTransaction(async () => {
    await banco.executeNonQuery("INSERT INTO itens VALUES ('reverter')");
    iniciou.liberar(); await continuar.promessa; throw erro;
  });
  const rejeicao = expect(transacao).rejects.toBe(erro);
  await iniciou.promessa;
  const externa = banco.executeNonQuery("INSERT INTO itens VALUES ('preservar')");
  continuar.liberar(); await rejeicao; await externa;
  expect(await banco.executeQuery('SELECT id FROM itens')).toEqual([{ id: 'preservar' }]);
});

it('recusa aninhamento sem prejudicar a transação externa', async () => {
  await banco.withTransaction(async () => {
    await expect(banco.withTransaction(async () => undefined)).rejects.toThrow('aninhadas');
    await expect(banco.criarBackupConsistente(path.join(ambiente.diretorio, 'indevido.db'))).rejects.toThrow('dentro de uma transação');
    await banco.executeNonQuery("INSERT INTO itens VALUES ('externa')");
  });
  await expect(banco.withTransaction(async () => banco.executeQuery('SELECT id FROM itens')))
    .resolves.toEqual([{ id: 'externa' }]);
});

it('fecha somente após as operações pendentes e reabre com os PRAGMAs ativos', async () => {
  const iniciou = barreira(); const continuar = barreira();
  const transacao = banco.withTransaction(async () => {
    iniciou.liberar(); await continuar.promessa;
    await banco.executeNonQuery("INSERT INTO itens VALUES ('persistida')");
  });
  await iniciou.promessa;
  const fechar = banco.closeDatabase();
  continuar.liberar(); await transacao; await fechar;
  expect(await banco.executeQuery('SELECT id FROM itens')).toEqual([{ id: 'persistida' }]);
  expect(await banco.executeQuery('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
});
