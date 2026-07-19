import { getLogger } from '../utils/logger.js';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import type { DatabaseRow } from '../types/database.js';

const log = getLogger('database');

// Configuração do banco de dados
const DB_DIR = app.getPath('userData');
const DB_PATH = path.join(DB_DIR, 'laudopericial.db');

// Singleton para conexão do banco de dados
let dbInstance: sqlite3.Database | null = null;

/**
 * Obtém ou cria conexão com o banco de dados SQLite
 */
const getDatabase = async (): Promise<sqlite3.Database> => {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Garantir que o diretório existe
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      log.debug(`Diretório de dados criado: ${DB_DIR}`);
    }

    log.debug(`Conectando ao banco de dados: ${DB_PATH}`);

    // Criar nova conexão
    const db = new sqlite3.Database(DB_PATH, (err: Error | null) => {
      if (err) {
        log.error('Erro ao conectar ao SQLite', err);
        throw err;
      }
    });
    dbInstance = db;

    // Configurar o banco de dados
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON;');
      db.run('PRAGMA journal_mode = WAL;');
      db.run('PRAGMA synchronous = NORMAL;');
    });

    log.debug(`Conexão com SQLite estabelecida com sucesso: ${DB_PATH}`);

    return db;
  } catch (error) {
    log.error('Erro ao conectar ao banco de dados SQLite', error);
    throw error;
  }
};

/**
 * Fecha a conexão com o banco de dados
 */
export const closeDatabase = async (): Promise<void> => {
  if (dbInstance) {
    const database = dbInstance;
    try {
      await new Promise<void>((resolve, reject) => {
        database.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      if (dbInstance === database) {
        dbInstance = null;
      }
      log.debug('Conexão com banco de dados fechada');
    } catch (error) {
      log.error('Erro ao fechar conexão com banco de dados', error);
      throw error;
    }
  }
};

/**
 * Executa uma query SQL com parâmetros
 */
export const executeQuery = async <T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<T[]> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    try {
      log.debug(`Executando query: ${sql}`, { params });

      db.all<T>(sql, params, (err: Error | null, rows: T[]) => {
        if (err) {
          log.error('Erro ao executar query', { sql, params, error: err });
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    } catch (error) {
      log.error('Erro ao executar query', { sql, params, error });
      reject(error);
    }
  });
};

/**
 * Executa uma query que não retorna resultado (INSERT, UPDATE, DELETE)
 */
export const executeNonQuery = async (sql: string, params: unknown[] = []): Promise<void> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    try {
      log.debug(`Executando non-query: ${sql}`, { params });

      db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          log.error('Erro ao executar non-query', { sql, params, error: err });
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (error) {
      log.error('Erro ao executar non-query', { sql, params, error });
      reject(error);
    }
  });
};

/**
 * Inicia uma transação
 */
const beginTransaction = async (): Promise<void> => {
  await executeNonQuery('BEGIN TRANSACTION');
  log.debug('Transação iniciada');
};

/**
 * Comita uma transação
 */
const commitTransaction = async (): Promise<void> => {
  await executeNonQuery('COMMIT');
  log.debug('Transação commitada');
};

/**
 * Reverte uma transação
 */
const rollbackTransaction = async (): Promise<void> => {
  await executeNonQuery('ROLLBACK');
  log.debug('Transação revertida');
};

/**
 * Executa uma função dentro de uma transação
 */
export const withTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
  await beginTransaction();

  try {
    const result = await fn();
    await commitTransaction();
    return result;
  } catch (error) {
    await rollbackTransaction();
    log.error('Erro na transação - revertendo', error);
    throw error;
  }
};
