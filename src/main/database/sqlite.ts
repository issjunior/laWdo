import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import sqlite3 from 'sqlite3';
import { getLogger } from '../utils/logger.js';
import type { DatabaseRow } from '../types/database.js';

const log = getLogger('database');
const diretorioBanco = app.getPath('userData');
const caminhoBanco = path.join(diretorioBanco, 'laudopericial.db');
let conexao: sqlite3.Database | null = null;
let abertura: Promise<sqlite3.Database> | null = null;
let falhaFatal: Error | null = null;
let fila: Promise<unknown> = Promise.resolve();
const contexto = new AsyncLocalStorage<{ ativa: boolean }>();

interface BackupSQLite {
  step(paginas: number, callback: (erro: Error | null) => void): void;
  finish(callback: (erro: Error | null) => void): void;
}
interface DatabaseComBackup extends sqlite3.Database {
  backup(caminhoDestino: string): BackupSQLite;
}

function enfileirar<T>(operacao: () => Promise<T>): Promise<T> {
  const atual = contexto.getStore();
  if (atual) {
    if (!atual.ativa) return Promise.reject(new Error('O contexto da transação já foi encerrado.'));
    return operacao();
  }
  const resultado = fila.then(operacao);
  fila = resultado.catch(() => undefined);
  return resultado;
}

function executarSql(banco: sqlite3.Database, sql: string, parametros: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => banco.run(sql, parametros, erro => erro ? reject(erro) : resolve()));
}

function fecharConexao(banco: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => banco.close(erro => erro ? reject(erro) : resolve()));
}

async function obterConexao(): Promise<sqlite3.Database> {
  if (falhaFatal) throw falhaFatal;
  if (conexao) return conexao;
  if (!abertura) {
    abertura = (async () => {
      await mkdir(diretorioBanco, { recursive: true });
      let parcial: sqlite3.Database | undefined;
      try {
        const banco = await new Promise<sqlite3.Database>((resolve, reject) => {
          parcial = new sqlite3.Database(caminhoBanco, erro => {
            if (erro) reject(erro);
            else if (parcial) resolve(parcial);
          });
        });
        for (const sql of ['PRAGMA foreign_keys = ON', 'PRAGMA journal_mode = WAL', 'PRAGMA synchronous = NORMAL']) {
          await executarSql(banco, sql);
        }
        conexao = banco;
        return banco;
      } catch (erro) {
        if (parcial) {
          try { await fecharConexao(parcial); }
          catch (erroFechamento) {
            // Uma abertura recusada pelo SQLite já deixa o handle fechado.
            if (!(erroFechamento instanceof Error) || !('code' in erroFechamento) || erroFechamento.code !== 'SQLITE_MISUSE') {
              falhaFatal = new Error('Não foi possível liberar o banco. Reinicie o aplicativo.', { cause: erroFechamento });
            }
          }
        }
        log.error('Erro ao preparar conexão SQLite', erro);
        throw erro;
      }
    })().finally(() => { abertura = null; });
  }
  return abertura;
}

export const closeDatabase = (): Promise<void> => {
  if (contexto.getStore()) return Promise.reject(new Error('Não é possível fechar o banco dentro de uma transação.'));
  return enfileirar(async () => {
    if (conexao) {
      await fecharConexao(conexao);
      conexao = null;
    }
  });
};

export const executeQuery = <T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<T[]> => enfileirar(async () => {
  const banco = await obterConexao();
  return new Promise<T[]>((resolve, reject) => banco.all<T>(sql, params, (erro, linhas) => {
    if (erro) { log.error('Erro ao executar query', { sql, error: erro }); reject(erro); }
    else resolve(linhas);
  }));
});

export const executeNonQuery = (sql: string, params: unknown[] = []): Promise<void> => enfileirar(async () => {
  const banco = await obterConexao();
  try { await executarSql(banco, sql, params); }
  catch (erro) { log.error('Erro ao executar non-query', { sql, error: erro }); throw erro; }
});

export const withTransaction = <T>(fn: () => Promise<T>): Promise<T> => {
  if (contexto.getStore()) return Promise.reject(new Error('Transações aninhadas não são permitidas.'));
  return enfileirar(async () => {
    const banco = await obterConexao();
    await executarSql(banco, 'BEGIN TRANSACTION');
    const estado = { ativa: true };
    return contexto.run(estado, async () => {
      try {
        const resultado = await fn();
        await executarSql(banco, 'COMMIT');
        return resultado;
      } catch (erro) {
        try { await executarSql(banco, 'ROLLBACK'); }
        catch (erroRollback) {
          falhaFatal = new Error('O banco está em estado incerto. Reinicie o aplicativo.', { cause: erroRollback });
          log.error('Falha ao reverter transação', { erroOriginal: erro, erroRollback });
        }
        throw erro;
      } finally { estado.ativa = false; }
    });
  });
};

export const criarBackupConsistente = (caminhoDestino: string): Promise<void> => {
  if (contexto.getStore()) return Promise.reject(new Error('Não é possível iniciar backup dentro de uma transação.'));
  return enfileirar(async () => {
    const banco = await obterConexao() as DatabaseComBackup;
    await new Promise<void>((resolve, reject) => {
      const backup = banco.backup(caminhoDestino);
      backup.step(-1, erro => {
        backup.finish(erroFinal => {
          if (erro || erroFinal) reject(erro || erroFinal);
          else resolve();
        });
      });
    });
  });
};
