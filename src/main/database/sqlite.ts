import { logInfo, logError, logDebug } from '../utils/logger';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

// Usaremos sqlite3 diretamente por enquanto
const sqlite3 = require('sqlite3');

// Configuração do banco de dados
const DB_DIR = app.getPath('userData');
const DB_PATH = path.join(DB_DIR, 'laudopericial.db');

// Singleton para conexão do banco de dados
let dbInstance: any = null;

/**
 * Obtém ou cria conexão com o banco de dados SQLite
 */
export const getDatabase = async (): Promise<any> => {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Garantir que o diretório existe
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      logInfo(`Diretório de dados criado: ${DB_DIR}`);
    }

    logInfo(`Conectando ao banco de dados: ${DB_PATH}`);

    // Criar nova conexão
    dbInstance = new sqlite3.Database(DB_PATH, (err: any) => {
      if (err) {
        logError('Erro ao conectar ao SQLite', err);
        throw err;
      }
    });

    // Configurar o banco de dados
    dbInstance.serialize(() => {
      dbInstance.run('PRAGMA foreign_keys = ON;');
      dbInstance.run('PRAGMA journal_mode = WAL;');
      dbInstance.run('PRAGMA synchronous = NORMAL;');
    });

    logInfo(`Conexão com SQLite estabelecida com sucesso: ${DB_PATH}`);

    return dbInstance;
  } catch (error) {
    logError('Erro ao conectar ao banco de dados SQLite', error);
    throw error;
  }
};

/**
 * Fecha a conexão com o banco de dados
 */
export const closeDatabase = async (): Promise<void> => {
  if (dbInstance) {
    try {
      await dbInstance.close();
      dbInstance = null;
      logInfo('Conexão com banco de dados fechada');
    } catch (error) {
      logError('Erro ao fechar conexão com banco de dados', error);
    }
  }
};

/**
 * Executa uma query SQL com parâmetros
 */
export const executeQuery = async <T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    try {
      logDebug(`Executando query: ${sql}`, { params });

      db.all(sql, params, (err: any, rows: any[]) => {
        if (err) {
          logError('Erro ao executar query', { sql, params, error: err });
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    } catch (error) {
      logError('Erro ao executar query', { sql, params, error });
      reject(error);
    }
  });
};

/**
 * Executa uma query que não retorna resultado (INSERT, UPDATE, DELETE)
 */
export const executeNonQuery = async (
  sql: string,
  params: any[] = []
): Promise<void> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    try {
      logDebug(`Executando non-query: ${sql}`, { params });

      db.run(sql, params, function (err: any) {
        if (err) {
          logError('Erro ao executar non-query', { sql, params, error: err });
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (error) {
      logError('Erro ao executar non-query', { sql, params, error });
      reject(error);
    }
  });
};

/**
 * Executa uma query e retorna o primeiro resultado
 */
export const executeSingle = async <T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> => {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    try {
      logDebug(`Executando query única: ${sql}`, { params });

      db.get(sql, params, (err: any, row: any) => {
        if (err) {
          logError('Erro ao executar query única', { sql, params, error: err });
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    } catch (error) {
      logError('Erro ao executar query única', { sql, params, error });
      reject(error);
    }
  });
};

/**
 * Inicia uma transação
 */
export const beginTransaction = async (): Promise<void> => {
  await executeNonQuery('BEGIN TRANSACTION');
  logDebug('Transação iniciada');
};

/**
 * Comita uma transação
 */
export const commitTransaction = async (): Promise<void> => {
  await executeNonQuery('COMMIT');
  logDebug('Transação commitada');
};

/**
 * Reverte uma transação
 */
export const rollbackTransaction = async (): Promise<void> => {
  await executeNonQuery('ROLLBACK');
  logDebug('Transação revertida');
};

/**
 * Executa uma função dentro de uma transação
 */
export const withTransaction = async <T>(
  fn: () => Promise<T>
): Promise<T> => {
  await beginTransaction();

  try {
    const result = await fn();
    await commitTransaction();
    return result;
  } catch (error) {
    await rollbackTransaction();
    logError('Erro na transação - revertendo', error);
    throw error;
  }
};

/**
 * Verifica se uma tabela existe
 */
export const tableExists = async (tableName: string): Promise<boolean> => {
  try {
    const result = await executeSingle<{ count: number }>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return result?.count === 1;
  } catch (error) {
    logError('Erro ao verificar existência de tabela', { tableName, error });
    return false;
  }
};

/**
 * Obtém informações sobre o banco de dados
 */
export const getDatabaseInfo = async () => {
  const tablesResult = await executeQuery<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );

  const tables = tablesResult.map(row => row.name);

  return {
    path: DB_PATH,
    tables,
    tableCount: tables.length,
  };
};

/**
 * Backup do banco de dados
 */
export const backupDatabase = async (backupPath?: string): Promise<string> => {
  const backupFilePath = backupPath || path.join(DB_DIR, `backup_${Date.now()}.db`);

  try {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Fazer backup usando VACUUM INTO
        db.run(`VACUUM INTO '${backupFilePath}'`, (err: any) => {
          if (err) {
            logError('Erro ao criar backup do banco de dados', err);
            reject(err);
          } else {
            logInfo(`Backup criado: ${backupFilePath}`);
            resolve(backupFilePath);
          }
        });
      });
    });
  } catch (error) {
    logError('Erro ao criar backup do banco de dados', error);
    throw error;
  }
};