import { logInfo, logError } from '../utils/logger';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import {
  getDatabase,
  executeNonQuery,
  executeQuery,
  backupDatabase as sqliteBackup,
} from './sqlite';

// Diretório do banco de dados
const DB_DIR = app.getPath('userData');
const DB_PATH = path.join(DB_DIR, 'laudopericial.db');

// Versão atual do schema
const CURRENT_SCHEMA_VERSION = 1;

/**
 * Configura e inicializa o banco de dados SQLite
 */
export const setupDatabase = async (): Promise<void> => {
  try {
    // Garantir que o diretório existe
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      logInfo(`Diretório de dados criado: ${DB_DIR}`);
    }

    // Verificar se o arquivo de banco de dados existe
    const dbExists = fs.existsSync(DB_PATH);

    if (!dbExists) {
      logInfo(`Banco de dados não encontrado. Criando novo: ${DB_PATH}`);
      await createDatabaseSchema();
      await setSchemaVersion(CURRENT_SCHEMA_VERSION);
    } else {
      logInfo(`Banco de dados encontrado: ${DB_PATH}`);
      await checkAndApplyMigrations();
    }

    // Testar conexão
    await testDatabaseConnection();

    logInfo('Banco de dados inicializado com sucesso');
  } catch (error) {
    logError('Erro ao inicializar banco de dados', error);
    throw error;
  }
};

/**
 * Cria o schema inicial do banco de dados
 */
const createDatabaseSchema = async (): Promise<void> => {
  logInfo('Criando schema inicial do banco de dados...');

  try {
    // Criar tabela de schema version
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY,
        version INTEGER NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de usuários (peritos)
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        matricula TEXT,
        telefone TEXT,
        cargo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de solicitantes (órgãos/varas/delegacias)
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS solicitantes (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        endereco TEXT,
        telefone TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de tipos de exame
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS tipos_exame (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE,
        descricao TEXT,
        template_padrao TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de REPs (Requisições de Exame Pericial)
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS reps (
        id TEXT PRIMARY KEY,
        numero TEXT NOT NULL UNIQUE,
        solicitante_id TEXT NOT NULL,
        tipo_exame_id TEXT NOT NULL,
        data_requisicao DATETIME NOT NULL,
        prazo DATETIME,
        status TEXT NOT NULL DEFAULT 'Pendente',
        observacoes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (solicitante_id) REFERENCES solicitantes(id),
        FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame(id)
      )
    `);

    // Tabela de laudos
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS laudos (
        id TEXT PRIMARY KEY,
        rep_id TEXT NOT NULL UNIQUE,
        perito_id TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Em andamento',
        data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_conclusao DATETIME,
        data_entrega DATETIME,
        versao INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rep_id) REFERENCES reps(id),
        FOREIGN KEY (perito_id) REFERENCES users(id)
      )
    `);

    // Tabela de imagens do laudo
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS imagens_laudo (
        id TEXT PRIMARY KEY,
        laudo_id TEXT NOT NULL,
        caminho TEXT NOT NULL,
        legenda TEXT NOT NULL,
        numero_figura INTEGER NOT NULL,
        sequencia INTEGER NOT NULL DEFAULT 0,
        latitude REAL,
        longitude REAL,
        data_captura DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (laudo_id) REFERENCES laudos(id)
      )
    `);

    // Tabela de placeholders
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS placeholders (
        id TEXT PRIMARY KEY,
        chave TEXT NOT NULL UNIQUE,
        valor TEXT NOT NULL,
        descricao TEXT,
        categoria TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de logs de auditoria
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS logs_auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT,
        acao TEXT NOT NULL,
        entidade TEXT NOT NULL,
        entidade_id TEXT,
        detalhes TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar índices
    await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_reps_status ON reps(status)');
    await executeNonQuery(
      'CREATE INDEX IF NOT EXISTS idx_reps_solicitante ON reps(solicitante_id)'
    );
    await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_laudos_status ON laudos(status)');
    await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_laudos_rep ON laudos(rep_id)');
    await executeNonQuery(
      'CREATE INDEX IF NOT EXISTS idx_imagens_laudo ON imagens_laudo(laudo_id)'
    );
    await executeNonQuery(
      'CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario ON logs_auditoria(usuario_id)'
    );
    await executeNonQuery(
      'CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created ON logs_auditoria(created_at)'
    );

    logInfo('Schema inicial criado com sucesso');
  } catch (error) {
    logError('Erro ao criar schema inicial', error);
    throw error;
  }
};

/**
 * Define a versão do schema
 */
const setSchemaVersion = async (version: number): Promise<void> => {
  await executeNonQuery('INSERT INTO schema_version (version) VALUES (?)', [version]);
  logInfo(`Schema version definida para ${version}`);
};

/**
 * Obtém a versão atual do schema
 */
const getSchemaVersion = async (): Promise<number> => {
  try {
    const result = await executeQuery<{ max_version: number }>(
      'SELECT MAX(version) as max_version FROM schema_version'
    );
    return result[0]?.max_version || 0;
  } catch (error) {
    // Se a tabela não existir, assumir versão 0
    return 0;
  }
};

/**
 * Verifica e aplica migrations se necessário
 */
const checkAndApplyMigrations = async (): Promise<void> => {
  const currentVersion = await getSchemaVersion();

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    logInfo(`Aplicando migrations da versão ${currentVersion} para ${CURRENT_SCHEMA_VERSION}...`);

    // Aqui você pode adicionar lógica de migrations específicas
    await applyMigrations(currentVersion);

    await setSchemaVersion(CURRENT_SCHEMA_VERSION);
    logInfo('Migrations aplicadas com sucesso');
  } else {
    logInfo(`Schema está atualizado (versão ${currentVersion})`);
  }
};

/**
 * Aplica migrations específicas
 */
const applyMigrations = async (fromVersion: number): Promise<void> => {
  // Implementar migrations específicas conforme necessário
  // Exemplo:
  // if (fromVersion < 2) {
  //   await executeNonQuery('ALTER TABLE users ADD COLUMN telefone TEXT');
  // }

  logInfo(`Aplicadas migrations da versão ${fromVersion}`);
};

/**
 * Testa a conexão com o banco de dados
 */
const testDatabaseConnection = async (): Promise<void> => {
  try {
    const result = await executeQuery<{ test: number }>('SELECT 1 as test');
    if (result[0]?.test === 1) {
      logInfo('Teste de conexão com banco de dados: OK');
    } else {
      throw new Error('Teste de conexão falhou');
    }
  } catch (error) {
    logError('Teste de conexão com banco de dados falhou', error);
    throw error;
  }
};

/**
 * Backup do banco de dados
 */
export const backupDatabase = async (backupPath?: string): Promise<string> => {
  const backupFilePath = backupPath || path.join(DB_DIR, `backup_${Date.now()}.db`);

  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Banco de dados não encontrado para backup');
    }

    // Copiar arquivo do banco de dados
    fs.copyFileSync(DB_PATH, backupFilePath);

    logInfo(`Backup criado: ${backupFilePath}`);
    return backupFilePath;
  } catch (error) {
    logError('Erro ao criar backup do banco de dados', error);
    throw error;
  }
};

/**
 * Restaura banco de dados de backup
 */
export const restoreDatabase = async (backupPath: string): Promise<void> => {
  try {
    if (!fs.existsSync(backupPath)) {
      throw new Error('Arquivo de backup não encontrado');
    }

    // Fazer backup do banco atual antes de restaurar
    const currentBackupPath = await backupDatabase(
      path.join(DB_DIR, `pre_restore_${Date.now()}.db`)
    );
    logInfo(`Backup pré-restauração criado: ${currentBackupPath}`);

    // Restaurar backup
    fs.copyFileSync(backupPath, DB_PATH);

    logInfo(`Banco de dados restaurado de: ${backupPath}`);
  } catch (error) {
    logError('Erro ao restaurar banco de dados', error);
    throw error;
  }
};

/**
 * Verifica integridade do banco de dados
 */
export const checkDatabaseIntegrity = async (): Promise<boolean> => {
  try {
    // TODO: Implementar verificação real de integridade
    logInfo('Verificação de integridade do banco de dados (mock)');
    return true;
  } catch (error) {
    logError('Erro ao verificar integridade do banco de dados', error);
    return false;
  }
};

/**
 * Obtém informações do banco de dados
 */
export const getDatabaseInfo = (): {
  path: string;
  size: number;
  exists: boolean;
  lastModified?: Date;
} => {
  try {
    const stats = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;

    return {
      path: DB_PATH,
      size: stats?.size || 0,
      exists: fs.existsSync(DB_PATH),
      lastModified: stats?.mtime,
    };
  } catch (error) {
    logError('Erro ao obter informações do banco de dados', error);
    return {
      path: DB_PATH,
      size: 0,
      exists: false,
    };
  }
};
