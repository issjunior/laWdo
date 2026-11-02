import { beforeEach, expect, it, vi } from 'vitest';
const ambiente = vi.hoisted(() => ({ abrir: vi.fn(), executar: vi.fn(), fechar: vi.fn(), ler: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => 'banco-teste' } }));
vi.mock('node:fs/promises', async importar => ({ ...await importar<typeof import('node:fs/promises')>(), mkdir: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../main/utils/logger.js', () => ({ getLogger: () => ({ error: vi.fn() }) }));
vi.mock('sqlite3', () => ({ default: { Database: class {
  constructor(_caminho: string, callback: (erro: Error | null) => void) { ambiente.abrir(); queueMicrotask(() => callback(ambiente.abrir.mock.results.at(-1)?.value ?? null)); }
  run(sql: string, _params: unknown[], callback: (erro: Error | null) => void) { queueMicrotask(() => callback(ambiente.executar(sql) ?? null)); }
  all(_sql: string, _params: unknown[], callback: (erro: Error | null, linhas: unknown[]) => void) { ambiente.ler(); callback(null, []); }
  close(callback: (erro: Error | null) => void) { ambiente.fechar(); callback(null); }
} } }));
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); });

it('rejeita falha assíncrona de abertura e permite nova tentativa após limpeza', async () => {
  const erro = new Error('disco indisponível'); ambiente.abrir.mockReturnValueOnce(erro);
  const banco = await import('../../main/database/sqlite');
  await expect(banco.executeQuery('SELECT 1')).rejects.toBe(erro);
  expect(ambiente.fechar).toHaveBeenCalledTimes(1);
  await expect(banco.executeQuery('SELECT 1')).resolves.toEqual([]);
  expect(ambiente.abrir).toHaveBeenCalledTimes(2);
});

it('não publica a conexão quando um PRAGMA falha', async () => {
  const erro = new Error('pragma recusado'); ambiente.executar.mockReturnValueOnce(erro);
  const banco = await import('../../main/database/sqlite');
  await expect(banco.executeQuery('SELECT 1')).rejects.toBe(erro);
  expect(ambiente.ler).not.toHaveBeenCalled();
  await Promise.all([banco.executeQuery('SELECT 1'), banco.executeQuery('SELECT 2')]);
  expect(ambiente.abrir).toHaveBeenCalledTimes(2);
});

it('preserva o erro original e bloqueia a conexão se o rollback falhar', async () => {
  const original = new Error('falha de negócio');
  ambiente.executar.mockImplementation(sql => sql === 'ROLLBACK' ? new Error('falha no rollback') : null);
  const banco = await import('../../main/database/sqlite');
  await expect(banco.withTransaction(async () => { throw original; })).rejects.toBe(original);
  await expect(banco.executeQuery('SELECT 1')).rejects.toThrow('estado incerto');
  expect(ambiente.ler).not.toHaveBeenCalled();
});
