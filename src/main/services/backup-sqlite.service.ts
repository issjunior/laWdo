import sqlite3 from 'sqlite3';

export async function abrirBancoBackup(caminho: string, somenteLeitura = false): Promise<sqlite3.Database> {
  return await new Promise((resolve, reject) => {
    const modo = somenteLeitura ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE;
    const banco = new sqlite3.Database(caminho, modo, erro => erro ? reject(erro) : resolve(banco));
  });
}

export async function consultarBackup<T>(banco: sqlite3.Database, sql: string, parametros: unknown[] = []): Promise<T[]> {
  return await new Promise((resolve, reject) => {
    banco.all(sql, parametros, (erro, linhas: T[]) => erro ? reject(erro) : resolve(linhas));
  });
}

export async function executarBackup(banco: sqlite3.Database, sql: string, parametros: unknown[] = []): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    banco.run(sql, parametros, erro => erro ? reject(erro) : resolve());
  });
}

export async function encerrarBancoBackup(banco: sqlite3.Database): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    banco.close(erro => erro ? reject(erro) : resolve());
  });
}

export async function verificarBancoBackup(banco: sqlite3.Database): Promise<number> {
  const integridade = await consultarBackup<{ integrity_check: string }>(banco, 'PRAGMA integrity_check');
  if (integridade.length !== 1 || integridade[0]?.integrity_check !== 'ok') throw new Error('Banco do backup está corrompido.');
  const violacoes = await consultarBackup(banco, 'PRAGMA foreign_key_check');
  if (violacoes.length > 0) throw new Error('Banco do backup contém vínculos inválidos.');
  const versoes = await consultarBackup<{ version: number }>(banco, 'SELECT MAX(version) AS version FROM schema_version');
  const versao = versoes[0]?.version;
  if (!Number.isInteger(versao) || versao < 1) throw new Error('Versão do banco inválida.');
  return versao;
}
