import { getLogger } from '../utils/logger.js';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import {
  getDatabase,
  executeQuery,
  executeNonQuery,
  executeSingle,
  closeDatabase,
} from './sqlite.js';

const log = getLogger('database');

// Diretório do banco de dados
const DB_DIR = app.getPath('userData');
const DB_PATH = path.join(DB_DIR, 'laudopericial.db');

// Versão atual do schema
const CURRENT_SCHEMA_VERSION = 24;

/**
 * Configura e inicializa o banco de dados SQLite
 */
export const setupDatabase = async (): Promise<void> => {
  try {
    // Garantir que o diretório existe
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      log.debug(`Diretório de dados criado: ${DB_DIR}`);
    }

    // Garantir que o diretório de imagens existe
    const imagensDir = path.join(DB_DIR, 'imagens');
    if (!fs.existsSync(imagensDir)) {
      fs.mkdirSync(imagensDir, { recursive: true });
      log.debug(`Diretório de imagens criado: ${imagensDir}`);
    }

    // Verificar se o arquivo de banco de dados existe
    const dbExists = fs.existsSync(DB_PATH);

    if (!dbExists) {
      log.debug(`Banco de dados não encontrado. Criando novo: ${DB_PATH}`);
      await createDatabaseSchema();
      await setSchemaVersion(CURRENT_SCHEMA_VERSION);
    } else {
      log.debug(`Banco de dados encontrado: ${DB_PATH}`);
      await checkAndApplyMigrations();
    }

    // Testar conexão
    await testDatabaseConnection();

    log.debug('Banco de dados inicializado com sucesso');
  } catch (error) {
    log.error('Erro ao inicializar banco de dados', error);
    throw error;
  }
};

/**
 * Cria o schema inicial do banco de dados
 */
const createDatabaseSchema = async (): Promise<void> => {
  log.debug('Criando schema inicial do banco de dados...');

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
        lotacao TEXT,
        username TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL,
        ativo BOOLEAN DEFAULT 1,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        foto_url TEXT
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
        ativo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de tipos de exame
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS tipos_exame (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        descricao TEXT,
        template_padrao TEXT,
        codigo TEXT NOT NULL DEFAULT '' UNIQUE,
        eh_local INTEGER NOT NULL DEFAULT 0,
        ativo INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de REPs (Requisições de Exame Pericial)
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS reps (
        id TEXT PRIMARY KEY,
        numero TEXT NOT NULL UNIQUE,
        solicitante_id TEXT,
        tipo_exame_id TEXT,
        data_requisicao DATETIME NOT NULL,
        prazo DATETIME,
        status TEXT NOT NULL DEFAULT 'Pendente',
        tipo_solicitacao TEXT,
        numero_documento TEXT,
        data_documento DATETIME,
        autoridade_solicitante TEXT,
        data_acionamento DATETIME,
        data_chegada DATETIME,
        data_saida DATETIME,
        local_fato TEXT,
        latitude REAL,
        longitude REAL,
        lacre_entrada TEXT,
        lacre_saida TEXT,
        usuario_id TEXT,
        numero_bo TEXT,
        numero_ip TEXT,
        observacoes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (solicitante_id) REFERENCES solicitantes(id),
        FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame(id),
        FOREIGN KEY (usuario_id) REFERENCES users(id)
      )
    `);

    // Tabela de laudos
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS laudos (
        id TEXT PRIMARY KEY,
        rep_id TEXT NOT NULL UNIQUE,
        perito_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Em andamento',
        data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_conclusao DATETIME,
        data_entrega DATETIME,
        versao INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rep_id) REFERENCES reps(id),
        FOREIGN KEY (perito_id) REFERENCES users(id),
        FOREIGN KEY (template_id) REFERENCES templates(id)
      )
    `);

    // Tabela de categorias de placeholders
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS categorias_placeholders (
        id TEXT PRIMARY KEY,
        chave TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL UNIQUE,
        descricao TEXT,
        cor TEXT,
        icone TEXT,
        parent_id TEXT,
        is_sistema INTEGER NOT NULL DEFAULT 0,
        ordem INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categorias_placeholders(id) ON DELETE SET NULL
      )
    `);

    await executeNonQuery(
      'CREATE INDEX IF NOT EXISTS idx_categorias_placeholders_parent ON categorias_placeholders(parent_id)'
    );

    // Seed categorias de sistema
    await executeNonQuery(`
      INSERT OR IGNORE INTO categorias_placeholders (id, chave, label, descricao, cor, icone, is_sistema, ordem)
      VALUES
        ('cat-rep', 'REP', 'REP/Laudo', 'Dados da Requisição de Exame Pericial e do Laudo', 'blue', 'FileText', 1, 1),
        ('cat-perito', 'Perito', 'Perito', 'Informações do perito responsável', 'violet', 'UserCheck', 1, 2),
        ('cat-lacres', 'Lacres', 'Lacres', 'Lacres de entrada e saída', 'emerald', 'ShieldCheck', 1, 3),
        ('cat-solicitante', 'Solicitante', 'Solicitante', 'Dados do órgão solicitante', 'orange', 'Building2', 1, 4),
        ('cat-local', 'Local', 'Local', 'Dados do local do fato', 'teal', 'MapPin', 1, 5),
        ('cat-datas', 'Datas', 'Datas', 'Datas e informações temporais', 'amber', 'Calendar', 1, 6),
        ('cat-personalizados', 'Personalizados', 'Personalizados', 'Placeholders personalizados pelo usuário', 'pink', 'Edit', 0, 7),
        ('cat-sem-categoria', 'sem_categoria', 'Sem Categoria', 'Placeholders sem categoria definida', 'slate', 'Puzzle', 1, 999)
    `);

    // Tabela de placeholders
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS placeholders (
        id TEXT PRIMARY KEY,
        chave TEXT NOT NULL UNIQUE,
        valor TEXT NOT NULL,
        descricao TEXT,
        categoria_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias_placeholders(id) ON DELETE SET NULL
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

    // Tabela de templates de laudo
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        tipo_exame_id TEXT,
        nome TEXT NOT NULL,
        descricao TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame(id)
      )
    `);

    // Seed: Template sistema "Não definido"
    await executeNonQuery(`
      INSERT OR IGNORE INTO templates (id, nome, descricao, tipo_exame_id, created_at, updated_at)
      VALUES ('tpl-nao-definido', 'Não definido', 'Template padrão do sistema. Nenhum laudo é gerado automaticamente.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    // Tabela de seções do template
    await executeNonQuery(`
      CREATE TABLE IF NOT EXISTS secoes_template (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        nome TEXT NOT NULL,
        ordem INTEGER NOT NULL DEFAULT 0,
        conteudo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
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
      'CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario ON logs_auditoria(usuario_id)'
    );
    await executeNonQuery(
      'CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created ON logs_auditoria(created_at)'
    );

    log.debug('Schema inicial criado com sucesso');
  } catch (error) {
    log.error('Erro ao criar schema inicial', error);
    throw error;
  }
};

/**
 * Define a versão do schema
 */
const setSchemaVersion = async (version: number): Promise<void> => {
  await executeNonQuery('INSERT INTO schema_version (version) VALUES (?)', [version]);
  log.debug(`Schema version definida para ${version}`);
};

/**
 * Obtém a versão atual do schema
 */
export const getSchemaVersion = async (): Promise<number> => {
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
    log.debug(`Aplicando migrations da versão ${currentVersion} para ${CURRENT_SCHEMA_VERSION}...`);

    // Aqui você pode adicionar lógica de migrations específicas
    await applyMigrations(currentVersion);

    await setSchemaVersion(CURRENT_SCHEMA_VERSION);
    log.debug('Migrations aplicadas com sucesso');
  } else {
    log.debug(`Schema está atualizado (versão ${currentVersion})`);
  }
};

/**
 * Aplica migrations específicas
 */
const applyMigrations = async (fromVersion: number): Promise<void> => {
  // Implementar migrations específicas conforme necessário

  // Migration versão 2: Adicionar campo ativo na tabela solicitantes
  if (fromVersion < 2) {
    try {
      // Verificar se a coluna já existe (evitar erro em re-execuções)
      const tables = await executeQuery<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='solicitantes'
      `);

      if (tables.length > 0) {
        const columns = await executeQuery<{ name: string }>(`
          PRAGMA table_info(solicitantes)
        `);

        const hasAtivoColumn = columns.some(col => col.name === 'ativo');

        if (!hasAtivoColumn) {
          await executeNonQuery('ALTER TABLE solicitantes ADD COLUMN ativo BOOLEAN DEFAULT 1');
          log.debug('Campo ativo adicionado na tabela solicitantes');
        }
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 2', error);
      throw error;
    }
  }

  // Migration versão 3: Adicionar campo updated_at na tabela tipos_exame
  if (fromVersion < 3) {
    try {
      const tables = await executeQuery<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='tipos_exame'
      `);

      if (tables.length > 0) {
        const columns = await executeQuery<{ name: string }>(`
          PRAGMA table_info(tipos_exame)
        `);

        const hasUpdatedAtColumn = columns.some(col => col.name === 'updated_at');

        if (!hasUpdatedAtColumn) {
          await executeNonQuery('ALTER TABLE tipos_exame ADD COLUMN updated_at DATETIME');
          await executeNonQuery(
            'UPDATE tipos_exame SET updated_at = created_at WHERE updated_at IS NULL'
          );
          log.debug('Campo updated_at adicionado na tabela tipos_exame');
        }
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 3', error);
      throw error;
    }
  }

  // Migration versão 4: Garantir colunas necessárias na tabela users
  if (fromVersion < 4) {
    try {
      const tables = await executeQuery<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='users'
      `);

      if (tables.length > 0) {
        const columns = await executeQuery<{ name: string }>(`
          PRAGMA table_info(users)
        `);

        const hasLotacao = columns.some(col => col.name === 'lotacao');
        const hasUsername = columns.some(col => col.name === 'username');
        const hasSenhaHash = columns.some(col => col.name === 'senha_hash');
        const hasAtivo = columns.some(col => col.name === 'ativo');

        if (!hasLotacao) {
          await executeNonQuery('ALTER TABLE users ADD COLUMN lotacao TEXT');
          log.debug('Campo lotacao adicionado na tabela users');
        }

        if (!hasUsername) {
          await executeNonQuery('ALTER TABLE users ADD COLUMN username TEXT');
          await executeNonQuery(`
            UPDATE users
            SET username = LOWER(
              CASE
                WHEN INSTR(email, '@') > 1 THEN SUBSTR(email, 1, INSTR(email, '@') - 1)
                ELSE email
              END
            )
            WHERE username IS NULL OR username = ''
          `);
          log.debug('Campo username adicionado na tabela users');
        }

        if (!hasSenhaHash) {
          await executeNonQuery("ALTER TABLE users ADD COLUMN senha_hash TEXT DEFAULT 'senha_temporaria'");
          log.debug('Campo senha_hash adicionado na tabela users');
        }

        if (!hasAtivo) {
          await executeNonQuery('ALTER TABLE users ADD COLUMN ativo BOOLEAN DEFAULT 1');
          log.debug('Campo ativo adicionado na tabela users');
        }
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 4', error);
      throw error;
    }
  }

  // Migration versão 5: Garantir colunas de data na tabela users
  if (fromVersion < 5) {
    try {
      const tables = await executeQuery<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='users'
      `);

      if (tables.length > 0) {
        const columns = await executeQuery<{ name: string }>(`
          PRAGMA table_info(users)
        `);

        const hasDataCriacao = columns.some(col => col.name === 'data_criacao');
        const hasDataAtualizacao = columns.some(col => col.name === 'data_atualizacao');
        const hasCreatedAt = columns.some(col => col.name === 'created_at');
        const hasUpdatedAt = columns.some(col => col.name === 'updated_at');

        if (!hasDataCriacao) {
          await executeNonQuery('ALTER TABLE users ADD COLUMN data_criacao DATETIME');
          if (hasCreatedAt) {
            await executeNonQuery(`
              UPDATE users
              SET data_criacao = created_at
              WHERE data_criacao IS NULL
            `);
          } else {
            await executeNonQuery(`
              UPDATE users
              SET data_criacao = CURRENT_TIMESTAMP
              WHERE data_criacao IS NULL
            `);
          }
          log.debug('Campo data_criacao adicionado na tabela users');
        }

        if (!hasDataAtualizacao) {
          await executeNonQuery('ALTER TABLE users ADD COLUMN data_atualizacao DATETIME');
          if (hasUpdatedAt) {
            await executeNonQuery(`
              UPDATE users
              SET data_atualizacao = updated_at
              WHERE data_atualizacao IS NULL
            `);
          } else if (hasDataCriacao || hasCreatedAt) {
            await executeNonQuery(`
              UPDATE users
              SET data_atualizacao = COALESCE(data_criacao, CURRENT_TIMESTAMP)
              WHERE data_atualizacao IS NULL
            `);
          } else {
            await executeNonQuery(`
              UPDATE users
              SET data_atualizacao = CURRENT_TIMESTAMP
              WHERE data_atualizacao IS NULL
            `);
          }
          log.debug('Campo data_atualizacao adicionado na tabela users');
        }
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 5', error);
      throw error;
    }
  }

  // Migration versão 6: Adicionar campos codigo e eh_local na tabela tipos_exame
  if (fromVersion < 6) {
    try {
      const tables = await executeQuery<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='tipos_exame'
      `);

      if (tables.length > 0) {
        const columns = await executeQuery<{ name: string }>(`
          PRAGMA table_info(tipos_exame)
        `);

        if (!columns.some(col => col.name === 'codigo')) {
          await executeNonQuery('ALTER TABLE tipos_exame ADD COLUMN codigo TEXT NOT NULL DEFAULT \'\'');
          log.debug('Campo codigo adicionado na tabela tipos_exame');
        }

        if (!columns.some(col => col.name === 'eh_local')) {
          await executeNonQuery('ALTER TABLE tipos_exame ADD COLUMN eh_local INTEGER NOT NULL DEFAULT 0');
          log.debug('Campo eh_local adicionado na tabela tipos_exame');
        }

        // Buscar tipos existentes e gerar códigos automáticos se estiverem vazios
        const tipos = await executeQuery<{ id: string; nome: string; codigo: string }>(
          'SELECT id, nome, codigo FROM tipos_exame WHERE codigo IS NULL OR codigo = \'\''
        );
        for (let i = 0; i < tipos.length; i++) {
          const codigo = `T${String(i + 1).padStart(3, '0')}`;
          await executeNonQuery('UPDATE tipos_exame SET codigo = ? WHERE id = ?', [codigo, tipos[i].id]);
        }
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 6', error);
      throw error;
    }
  }

  // Migration versão 7: Remover UNIQUE de nome e adicionar UNIQUE em codigo na tabela tipos_exame
  if (fromVersion < 7) {
    try {
      const tables = await executeQuery<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='tipos_exame'
      `);

      if (tables.length > 0) {
        await executeNonQuery('PRAGMA foreign_keys = OFF');

        // Limpar tabela temporária de execução anterior que possa ter falhado
        await executeNonQuery('DROP TABLE IF EXISTS tipos_exame_nova');

        const columns = await executeQuery<{ name: string }>(`
          PRAGMA table_info(tipos_exame)
        `);
        const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
        const hasCodigo = columns.some(col => col.name === 'codigo');
        const hasEhLocal = columns.some(col => col.name === 'eh_local');
        const hasAtivo = columns.some(col => col.name === 'ativo');

        await executeNonQuery(`
          CREATE TABLE tipos_exame_nova (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            descricao TEXT,
            template_padrao TEXT,
            codigo TEXT NOT NULL DEFAULT '' UNIQUE,
            eh_local INTEGER NOT NULL DEFAULT 0,
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Copiar dados da tabela antiga para a nova
        let insertCols = 'id, nome, descricao, template_padrao';
        let selectCols = 'id, nome, descricao, template_padrao';
        if (hasUpdatedAt) {
          insertCols += ', created_at, updated_at';
          selectCols += ', created_at, updated_at';
        } else {
          insertCols += ', created_at, updated_at';
          selectCols += ', created_at, created_at';
        }
        if (hasCodigo) {
          insertCols += ', codigo';
          selectCols += ', codigo';
        } else {
          insertCols += ', codigo';
          selectCols += ', \'\' as codigo';
        }
        if (hasEhLocal) {
          insertCols += ', eh_local';
          selectCols += ', eh_local';
        } else {
          insertCols += ', eh_local';
          selectCols += ', 0 as eh_local';
        }
        if (hasAtivo) {
          insertCols += ', ativo';
          selectCols += ', ativo';
        } else {
          insertCols += ', ativo';
          selectCols += ', 1 as ativo';
        }

        await executeNonQuery(`
          INSERT INTO tipos_exame_nova (${insertCols})
          SELECT ${selectCols} FROM tipos_exame
        `);

        await executeNonQuery('DROP TABLE tipos_exame');
        await executeNonQuery('ALTER TABLE tipos_exame_nova RENAME TO tipos_exame');

        await executeNonQuery('PRAGMA foreign_keys = ON');

        log.debug('Migration v7: UNIQUE de nome removido, codigo definido como UNIQUE');
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 7', error);
      throw error;
    }
  }

  // Migration versão 8: Criar tabela de configurações
  if (fromVersion < 8) {
    try {
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS configuracoes (
          chave TEXT PRIMARY KEY,
          valor TEXT,
          tipo TEXT NOT NULL DEFAULT 'texto',
          descricao TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      log.debug('Migration v8: Tabela configuracoes criada');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 8', error);
      throw error;
    }
  }

  // Migration versão 9: Expandir colunas da tabela reps
  if (fromVersion < 9) {
    try {
      const tables = await executeQuery<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='reps'"
      );
      if (tables.length > 0) {
        const columns = await executeQuery<{ name: string }>('PRAGMA table_info(reps)');
        const colNames = columns.map(c => c.name);

        const addColumnIfMissing = async (col: string, def: string) => {
          if (!colNames.includes(col)) {
            await executeNonQuery(`ALTER TABLE reps ADD COLUMN ${col} ${def}`);
          }
        };

        await addColumnIfMissing('tipo_solicitacao', 'TEXT');
        await addColumnIfMissing('numero_documento', 'TEXT');
        await addColumnIfMissing('data_documento', 'DATETIME');
        await addColumnIfMissing('autoridade_solicitante', 'TEXT');
        await addColumnIfMissing('data_acionamento', 'DATETIME');
        await addColumnIfMissing('data_chegada', 'DATETIME');
        await addColumnIfMissing('data_saida', 'DATETIME');
        await addColumnIfMissing('local_fato', 'TEXT');
        await addColumnIfMissing('latitude', 'REAL');
        await addColumnIfMissing('longitude', 'REAL');
        await addColumnIfMissing('lacre_entrada', 'TEXT');
        await addColumnIfMissing('lacre_saida', 'TEXT');
        await addColumnIfMissing('usuario_id', 'TEXT');
        await addColumnIfMissing('numero_bo', 'TEXT');
        await addColumnIfMissing('numero_ip', 'TEXT');

        log.debug('Migration v9: Colunas expandidas na tabela reps');
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 9', error);
      throw error;
    }
  }

  // Migration versão 10: Remover constraints NOT NULL indevidas em colunas opcionais da tabela reps
  if (fromVersion < 10) {
    try {
      const tables = await executeQuery<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='reps'"
      );
      if (tables.length > 0) {
        // Colunas que devem aceitar NULL
        const opcionais = [
          'solicitante_id', 'tipo_exame_id', 'tipo_solicitacao', 'numero_documento',
          'data_documento', 'autoridade_solicitante', 'data_acionamento',
          'data_chegada', 'data_saida', 'local_fato', 'latitude', 'longitude',
          'lacre_entrada', 'lacre_saida', 'usuario_id', 'numero_bo', 'numero_ip',
          'observacoes', 'prazo',
        ];

        const columns = await executeQuery<{ name: string; notnull: number; dflt_value: string | null }>(
          'PRAGMA table_info(reps)'
        );

        const colunasComNotNull = columns.filter(
          c => opcionais.includes(c.name) && c.notnull === 1 && c.dflt_value === null
        );

        if (colunasComNotNull.length > 0) {
          log.debug(`Migration v10: Corrigindo NOT NULL em: ${colunasComNotNull.map(c => c.name).join(', ')}`);

          // Recriar a tabela com schema correto
          await executeNonQuery(`
            CREATE TABLE reps_v10 (
              id TEXT PRIMARY KEY,
              numero TEXT NOT NULL UNIQUE,
              solicitante_id TEXT,
              tipo_exame_id TEXT,
              data_requisicao DATETIME NOT NULL,
              prazo DATETIME,
              status TEXT NOT NULL DEFAULT 'Pendente',
              tipo_solicitacao TEXT,
              numero_documento TEXT,
              data_documento DATETIME,
              autoridade_solicitante TEXT,
              data_acionamento DATETIME,
              data_chegada DATETIME,
              data_saida DATETIME,
              local_fato TEXT,
              latitude REAL,
              longitude REAL,
              lacre_entrada TEXT,
              lacre_saida TEXT,
              usuario_id TEXT,
              numero_bo TEXT,
              numero_ip TEXT,
              observacoes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (solicitante_id) REFERENCES solicitantes(id),
              FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame(id),
              FOREIGN KEY (usuario_id) REFERENCES users(id)
            )
          `);

          await executeNonQuery('INSERT INTO reps_v10 SELECT * FROM reps');
          await executeNonQuery('DROP TABLE reps');
          await executeNonQuery('ALTER TABLE reps_v10 RENAME TO reps');

          // Recriar índices
          await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_reps_status ON reps(status)');
          await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_reps_solicitante ON reps(solicitante_id)');

          log.debug('Migration v10: Constraints NOT NULL removidas com sucesso');
        } else {
          log.debug('Migration v10: Nenhuma coluna com NOT NULL indevido encontrada');
        }
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 10', error);
      throw error;
    }
  }

  // Migration versão 11: Criar tabelas de templates e seções
  if (fromVersion < 11) {
    try {
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          tipo_exame_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          descricao TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame(id)
        )
      `);

      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS secoes_template (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          ordem INTEGER NOT NULL DEFAULT 0,
          conteudo TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
        )
      `);

      log.debug('Migration v11: Tabelas templates e secoes_template criadas');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 11', error);
      throw error;
    }
  }

  // Migration versão 12: Adicionar template_id na tabela laudos
  if (fromVersion < 12) {
    try {
      const columns = await executeQuery<{ name: string }>(`PRAGMA table_info(laudos)`);
      const hasTemplateId = columns.some(col => col.name === 'template_id');

      if (!hasTemplateId) {
        await executeNonQuery('ALTER TABLE laudos ADD COLUMN template_id TEXT');
        log.debug('Migration v12: Coluna template_id adicionada na tabela laudos');
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 12', error);
      throw error;
    }
  }

  // Migration versão 13: Permitir tipo_exame_id NULL e criar template sistema
  if (fromVersion < 13) {
    try {
      // Recria tabela templates com tipo_exame_id nullable (SQLite não suporta ALTER COLUMN)
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS templates_v13 (
          id TEXT PRIMARY KEY,
          tipo_exame_id TEXT,
          nome TEXT NOT NULL,
          descricao TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame(id)
        )
      `);
      await executeNonQuery(`
        INSERT OR IGNORE INTO templates_v13 (id, tipo_exame_id, nome, descricao, created_at, updated_at)
        SELECT id, tipo_exame_id, nome, descricao, created_at, updated_at FROM templates
      `);
      await executeNonQuery('DROP TABLE templates');
      await executeNonQuery('ALTER TABLE templates_v13 RENAME TO templates');

      // Recria secoes_template (FK depende de templates)
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS secoes_template_v13 (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          conteudo TEXT,
          ordem INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
        )
      `);
      await executeNonQuery(`
        INSERT OR IGNORE INTO secoes_template_v13 (id, template_id, nome, conteudo, ordem, created_at, updated_at)
        SELECT id, template_id, nome, conteudo, ordem, created_at, updated_at FROM secoes_template
      `);
      await executeNonQuery('DROP TABLE secoes_template');
      await executeNonQuery('ALTER TABLE secoes_template_v13 RENAME TO secoes_template');

      // Insere o template sistema
      await executeNonQuery(`
        INSERT OR IGNORE INTO templates (id, nome, descricao, tipo_exame_id, created_at, updated_at)
        VALUES ('tpl-nao-definido', 'Não definido', 'Template padrão do sistema. Nenhum laudo é gerado automaticamente.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      log.debug('Migration v13: tipo_exame_id nullable + Template "Não definido" criado');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 13', error);
      throw error;
    }
  }

  // Migration versão 15: Criar tabela categorias_placeholders e atualizar placeholders
  if (fromVersion < 15) {
    try {
      // Cria a tabela de categorias
      await executeNonQuery(`
        CREATE TABLE IF NOT EXISTS categorias_placeholders (
          id TEXT PRIMARY KEY,
          chave TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL UNIQUE,
          descricao TEXT,
          cor TEXT,
          icone TEXT,
          is_sistema INTEGER NOT NULL DEFAULT 0,
          ordem INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Popula categorias de sistema com UUIDs fáceis/fixos
      const catRepId = 'cat-rep';
      const catPeritoId = 'cat-perito';
      const catSemCategoriaId = 'cat-sem-categoria';

      await executeNonQuery(`
        INSERT OR IGNORE INTO categorias_placeholders (id, chave, label, descricao, cor, icone, is_sistema, ordem)
        VALUES 
          ('${catRepId}', 'REP', 'REP/Laudo', 'Dados da Requisição de Exame Pericial e do Laudo', 'blue', 'FileText', 1, 1),
          ('${catPeritoId}', 'Perito', 'Perito', 'Informações do perito responsável', 'violet', 'UserCheck', 1, 2),
          ('cat-lacres', 'Lacres', 'Lacres', 'Lacres de entrada e saída', 'emerald', 'ShieldCheck', 1, 3),
          ('cat-solicitante', 'Solicitante', 'Solicitante', 'Dados do órgão solicitante', 'orange', 'Building2', 1, 4),
          ('cat-local', 'Local', 'Local', 'Dados do local do fato', 'teal', 'MapPin', 1, 5),
          ('cat-datas', 'Datas', 'Datas', 'Datas e informações temporais', 'amber', 'Calendar', 1, 6),
          ('cat-personalizados', 'Personalizados', 'Personalizados', 'Placeholders personalizados pelo usuário', 'pink', 'Edit', 0, 7),
          ('${catSemCategoriaId}', 'sem_categoria', 'Sem Categoria', 'Placeholders sem categoria definida', 'slate', 'Puzzle', 1, 999)
      `);

      // Atualiza a tabela placeholders para ter categoria_id em vez de categoria
      const columns = await executeQuery<{ name: string }>(`PRAGMA table_info(placeholders)`);
      const hasCategoriaId = columns.some(col => col.name === 'categoria_id');

      if (!hasCategoriaId) {
        await executeNonQuery('PRAGMA foreign_keys = OFF');
        
        await executeNonQuery(`
          CREATE TABLE placeholders_v15 (
            id TEXT PRIMARY KEY,
            chave TEXT NOT NULL UNIQUE,
            valor TEXT NOT NULL,
            descricao TEXT,
            categoria_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (categoria_id) REFERENCES categorias_placeholders(id) ON DELETE SET NULL
          )
        `);

        // Copia os dados, mapeando a string antiga para o novo ID
        // 'REP' -> cat-rep
        // 'Perito' -> cat-perito
        // 'Personalizado' ou outros -> cat-sem-categoria
        await executeNonQuery(`
          INSERT INTO placeholders_v15 (id, chave, valor, descricao, created_at, updated_at, categoria_id)
          SELECT 
            id, chave, valor, descricao, created_at, updated_at,
            CASE 
              WHEN categoria = 'REP' THEN '${catRepId}'
              WHEN categoria = 'Perito' THEN '${catPeritoId}'
              ELSE '${catSemCategoriaId}'
            END as categoria_id
          FROM placeholders
        `);

        await executeNonQuery('DROP TABLE placeholders');
        await executeNonQuery('ALTER TABLE placeholders_v15 RENAME TO placeholders');
        
        await executeNonQuery('PRAGMA foreign_keys = ON');
        log.debug('Migration v15: Tabela categorias_placeholders criada e placeholders atualizada');
      }

    } catch (error) {
      log.error('Erro ao aplicar migration versão 15', error);
      throw error;
    }
  }

  // Migration versão 16: Garantir todas as 8 categorias de sistema e resolver conflitos
  if (fromVersion < 16) {
    try {
      const categoriasSistema = [
        { id: 'cat-rep', chave: 'REP', label: 'REP/Laudo', descricao: 'Dados da Requisição de Exame Pericial e do Laudo', cor: 'blue', icone: 'FileText', is_sistema: 1, ordem: 1 },
        { id: 'cat-perito', chave: 'Perito', label: 'Perito', descricao: 'Informações do perito responsável', cor: 'violet', icone: 'UserCheck', is_sistema: 1, ordem: 2 },
        { id: 'cat-lacres', chave: 'Lacres', label: 'Lacres', descricao: 'Lacres de entrada e saída', cor: 'emerald', icone: 'ShieldCheck', is_sistema: 1, ordem: 3 },
        { id: 'cat-solicitante', chave: 'Solicitante', label: 'Solicitante', descricao: 'Dados do órgão solicitante', cor: 'orange', icone: 'Building2', is_sistema: 1, ordem: 4 },
        { id: 'cat-local', chave: 'Local', label: 'Local', descricao: 'Dados do local do fato', cor: 'teal', icone: 'MapPin', is_sistema: 1, ordem: 5 },
        { id: 'cat-datas', chave: 'Datas', label: 'Datas', descricao: 'Datas e informações temporais', cor: 'amber', icone: 'Calendar', is_sistema: 1, ordem: 6 },
        { id: 'cat-personalizados', chave: 'Personalizados', label: 'Personalizados', descricao: 'Placeholders personalizados pelo usuário', cor: 'pink', icone: 'Edit', is_sistema: 0, ordem: 7 },
        { id: 'cat-sem-categoria', chave: 'sem_categoria', label: 'Sem Categoria', descricao: 'Placeholders sem categoria definida', cor: 'slate', icone: 'Puzzle', is_sistema: 1, ordem: 999 },
      ];

      for (const cat of categoriasSistema) {
        // Resolve conflito: categoria com mesmo label mas ID diferente (criada pelo usuário)
        const conflitantes = await executeQuery<{ id: string }>(
          'SELECT id FROM categorias_placeholders WHERE label = ? AND id != ?',
          [cat.label, cat.id]
        );

        // Guarda placeholders dos conflitantes antes de deletar (FK usa ON DELETE SET NULL)
        const placeholderIds: string[] = [];
        for (const conflito of conflitantes) {
          const pids = await executeQuery<{ id: string }>(
            'SELECT id FROM placeholders WHERE categoria_id = ?', [conflito.id]
          );
          placeholderIds.push(...pids.map(p => p.id));
        }

        // Deleta categorias conflitantes (placeholders viram categoria_id=NULL)
        for (const conflito of conflitantes) {
          await executeNonQuery('DELETE FROM categorias_placeholders WHERE id = ?', [conflito.id]);
          log.debug(`Migration v16: Categoria conflitante "${cat.label}" (${conflito.id}) removida`);
        }

        // Insere ou atualiza a categoria do sistema (agora sem conflito de label UNIQUE)
        const existente = await executeQuery<{ id: string }>(
          'SELECT id FROM categorias_placeholders WHERE id = ?', [cat.id]
        );

        if (existente.length === 0) {
          await executeNonQuery(
            `INSERT INTO categorias_placeholders (id, chave, label, descricao, cor, icone, is_sistema, ordem)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [cat.id, cat.chave, cat.label, cat.descricao, cat.cor, cat.icone, cat.is_sistema, cat.ordem]
          );
        } else {
          await executeNonQuery(
            `UPDATE categorias_placeholders SET is_sistema = ?, chave = ?, descricao = ?, cor = ?, icone = ?, ordem = ?, updated_at = ?
             WHERE id = ?`,
            [cat.is_sistema, cat.chave, cat.descricao, cat.cor, cat.icone, cat.ordem, new Date().toISOString(), cat.id]
          );
        }

        // Move placeholders órfãos para a categoria sistema recém-criada
        for (const pid of placeholderIds) {
          await executeNonQuery(
            'UPDATE placeholders SET categoria_id = ?, updated_at = ? WHERE id = ?',
            [cat.id, new Date().toISOString(), pid]
          );
        }
        if (placeholderIds.length > 0) {
          log.debug(`Migration v16: ${placeholderIds.length} placeholder(s) movidos para categoria "${cat.label}" (${cat.id})`);
        }
      }

      log.debug('Migration v16: Todas as 8 categorias de sistema garantidas');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 16', error);
      throw error;
    }
  }

  // Migration versão 17: Remover eh_local da tabela tipos_exame e adicionar campos_especificos na tabela reps
  if (fromVersion < 17) {
    try {
      // 17a. Remover coluna eh_local
      const tipoExameCols = await executeQuery<{ name: string }>(
        'PRAGMA table_info(tipos_exame)'
      );
      const hasEhLocal = tipoExameCols.some(c => c.name === 'eh_local');

      if (hasEhLocal) {
        // SQLite não suporta DROP COLUMN direto em versões antigas.
        // Recriar a tabela sem a coluna eh_local.
        // Desabilitar FKs temporariamente para evitar constraint violations
        await executeNonQuery('PRAGMA foreign_keys = OFF');
        try {
          await executeNonQuery('DROP TABLE IF EXISTS tipos_exame_v17');
          await executeNonQuery(`
            CREATE TABLE tipos_exame_v17 (
              id TEXT PRIMARY KEY,
              codigo TEXT NOT NULL UNIQUE,
              nome TEXT NOT NULL,
              descricao TEXT,
              template_padrao TEXT,
              ativo BOOLEAN DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          await executeNonQuery(`
            INSERT INTO tipos_exame_v17 (id, codigo, nome, descricao, template_padrao, ativo, created_at, updated_at)
            SELECT id, codigo, nome, descricao, template_padrao, ativo, created_at, updated_at
            FROM tipos_exame
          `);

          await executeNonQuery('DROP TABLE tipos_exame');
          await executeNonQuery('ALTER TABLE tipos_exame_v17 RENAME TO tipos_exame');
        } finally {
          await executeNonQuery('PRAGMA foreign_keys = ON');
        }

        log.debug('Migration v17a: Coluna eh_local removida de tipos_exame');
      } else {
        log.debug('Migration v17a: Coluna eh_local já não existe');
      }

      // 17b. Adicionar coluna campos_especificos na tabela reps
      const repsCols = await executeQuery<{ name: string }>(
        'PRAGMA table_info(reps)'
      );
      const hasCamposEspecificos = repsCols.some(c => c.name === 'campos_especificos');

      if (!hasCamposEspecificos) {
        await executeNonQuery(
          'ALTER TABLE reps ADD COLUMN campos_especificos TEXT'
        );
        log.debug('Migration v17b: Coluna campos_especificos adicionada à tabela reps');
      } else {
        log.debug('Migration v17b: Coluna campos_especificos já existe');
      }

      log.debug('Migration v17: Concluída');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 17', error);
      throw error;
    }
  }

  // Migration versão 18: Adicionar coluna foto_url na tabela users
  if (fromVersion < 18) {
    try {
      const userCols = await executeQuery<{ name: string }>(
        'PRAGMA table_info(users)'
      );
      const hasFotoUrl = userCols.some(c => c.name === 'foto_url');

      if (!hasFotoUrl) {
        await executeNonQuery(
          'ALTER TABLE users ADD COLUMN foto_url TEXT'
        );
        log.debug('Migration v18: Coluna foto_url adicionada à tabela users');
      } else {
        log.debug('Migration v18: Coluna foto_url já existe');
      }

      log.debug('Migration v18: Concluída');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 18', error);
      throw error;
    }
  }

  // Migration versão 19: Expandir logs_auditoria para auditoria completa
  if (fromVersion < 19) {
    try {
      const logCols = await executeQuery<{ name: string }>(
        'PRAGMA table_info(logs_auditoria)'
      );

      const colunasParaAdicionar = [
        { nome: 'tipo_acao', def: "TEXT NOT NULL DEFAULT 'outro'" },
        { nome: 'modulo', def: "TEXT NOT NULL DEFAULT 'sistema'" },
        { nome: 'nivel', def: "TEXT NOT NULL DEFAULT 'info'" },
        { nome: 'mensagem', def: 'TEXT' },
        { nome: 'dados_anteriores', def: 'TEXT' },
        { nome: 'dados_novos', def: 'TEXT' },
      ];

      for (const col of colunasParaAdicionar) {
        if (!logCols.some(c => c.name === col.nome)) {
          await executeNonQuery(
            `ALTER TABLE logs_auditoria ADD COLUMN ${col.nome} ${col.def}`
          );
          log.debug(
            `Migration v19: Coluna ${col.nome} adicionada à tabela logs_auditoria`
          );
        }
      }

      await executeNonQuery(
        'CREATE INDEX IF NOT EXISTS idx_logs_auditoria_modulo ON logs_auditoria(modulo)'
      );
      await executeNonQuery(
        'CREATE INDEX IF NOT EXISTS idx_logs_auditoria_tipo ON logs_auditoria(tipo_acao)'
      );
      await executeNonQuery(
        'CREATE INDEX IF NOT EXISTS idx_logs_auditoria_entidade ON logs_auditoria(entidade, entidade_id)'
      );

      log.debug('Migration v19: Concluída');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 19', error);
      throw error;
    }
  }

  // Migration versão 20: Wizards e Banco de Peças
  if (fromVersion < 20) {
    try {
      await executeNonQuery('PRAGMA foreign_keys = OFF');
      try {
        // --- v20a: Recriar laudos sem UNIQUE em rep_id + novas colunas ---
        const laudosExistTable = await executeQuery<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='laudos'"
        );
        if (laudosExistTable.length > 0) {
          const laudosCols = await executeQuery<{ name: string; notnull: number; dflt_value: string | null }>('PRAGMA table_info(laudos)');
          const hasTipoCriacao = laudosCols.some(c => c.name === 'tipo_criacao');
          const hasRepIdUnique = laudosCols.some(c => c.name === 'rep_id' && c.notnull === 1);
          const needRecreate = !hasTipoCriacao || hasRepIdUnique;

          if (needRecreate) {
            await executeNonQuery('DROP TABLE IF EXISTS laudos_v20');
            await executeNonQuery(`
              CREATE TABLE laudos_v20 (
                id TEXT PRIMARY KEY,
                rep_id TEXT NOT NULL,
                perito_id TEXT NOT NULL,
                template_id TEXT NOT NULL,
                conteudo TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Em andamento',
                data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_conclusao DATETIME,
                data_entrega DATETIME,
                versao INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                tipo_criacao TEXT NOT NULL DEFAULT 'template',
                wizard_id TEXT,
                respostas_wizard TEXT,
                FOREIGN KEY (rep_id) REFERENCES reps(id),
                FOREIGN KEY (perito_id) REFERENCES users(id),
                FOREIGN KEY (template_id) REFERENCES templates(id),
                FOREIGN KEY (wizard_id) REFERENCES wizards(id)
              )
            `);

            await executeNonQuery(`
              INSERT INTO laudos_v20 (
                id, rep_id, perito_id, template_id, conteudo, status,
                data_inicio, data_conclusao, data_entrega, versao,
                created_at, updated_at
              )
              SELECT
                id, rep_id, perito_id, template_id, conteudo, status,
                data_inicio, data_conclusao, data_entrega, versao,
                created_at, updated_at
              FROM laudos
            `);

            await executeNonQuery('DROP TABLE laudos');
            await executeNonQuery('ALTER TABLE laudos_v20 RENAME TO laudos');

            await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_laudos_status ON laudos(status)');
            await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_laudos_rep ON laudos(rep_id)');
            log.debug('Migration v20a: Laudos recriada sem UNIQUE + colunas tipo_criacao, wizard_id, respostas_wizard');
          } else {
            log.debug('Migration v20a: Tabela laudos já contém as novas colunas, skip');
          }
        }

        // --- v20b: Criar novas tabelas do wizard ---

        await executeNonQuery(`
          CREATE TABLE IF NOT EXISTS wizards (
            id TEXT PRIMARY KEY,
            tipo_exame_id TEXT NOT NULL,
            template_id TEXT NOT NULL,
            nome TEXT NOT NULL,
            descricao TEXT,
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame(id),
            FOREIGN KEY (template_id) REFERENCES templates(id)
          )
        `);

        await executeNonQuery(`
          CREATE TABLE IF NOT EXISTS etapas_wizard (
            id TEXT PRIMARY KEY,
            wizard_id TEXT NOT NULL,
            etapa_pai_id TEXT,
            pergunta TEXT NOT NULL,
            descricao_ajuda TEXT,
            tipo_input TEXT NOT NULL DEFAULT 'select',
            nivel INTEGER NOT NULL DEFAULT 0,
            ordem INTEGER NOT NULL DEFAULT 0,
            obrigatorio INTEGER NOT NULL DEFAULT 1,
            multipla_escolha INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (wizard_id) REFERENCES wizards(id) ON DELETE CASCADE,
            FOREIGN KEY (etapa_pai_id) REFERENCES etapas_wizard(id) ON DELETE SET NULL
          )
        `);

        await executeNonQuery(`
          CREATE TABLE IF NOT EXISTS opcoes_etapa (
            id TEXT PRIMARY KEY,
            etapa_id TEXT NOT NULL,
            label TEXT NOT NULL,
            valor TEXT NOT NULL,
            etapa_filha_id TEXT,
            ordem INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (etapa_id) REFERENCES etapas_wizard(id) ON DELETE CASCADE,
            FOREIGN KEY (etapa_filha_id) REFERENCES etapas_wizard(id) ON DELETE SET NULL
          )
        `);

        await executeNonQuery(`
          CREATE TABLE IF NOT EXISTS pecas (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            descricao TEXT,
            conteudo TEXT NOT NULL,
            categoria TEXT,
            tags TEXT,
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await executeNonQuery(`
          CREATE TABLE IF NOT EXISTS regras_wizard (
            id TEXT PRIMARY KEY,
            wizard_id TEXT NOT NULL,
            peca_id TEXT NOT NULL,
            secao_template_id TEXT,
            condicoes TEXT NOT NULL DEFAULT '{}',
            ordem INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (wizard_id) REFERENCES wizards(id) ON DELETE CASCADE,
            FOREIGN KEY (peca_id) REFERENCES pecas(id) ON DELETE CASCADE,
            FOREIGN KEY (secao_template_id) REFERENCES secoes_template(id) ON DELETE SET NULL
          )
        `);

        await executeNonQuery(`
          CREATE TABLE IF NOT EXISTS respostas_wizard (
            id TEXT PRIMARY KEY,
            laudo_id TEXT NOT NULL,
            etapa_id TEXT NOT NULL,
            opcao_id TEXT,
            valor_texto TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (laudo_id) REFERENCES laudos(id) ON DELETE CASCADE,
            FOREIGN KEY (etapa_id) REFERENCES etapas_wizard(id),
            FOREIGN KEY (opcao_id) REFERENCES opcoes_etapa(id) ON DELETE SET NULL
          )
        `);

        log.debug('Migration v20b: Novas tabelas wizard criadas');

        // --- v20c: Índices ---
        await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_respostas_wizard_laudo ON respostas_wizard(laudo_id)');
        await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_regras_wizard_wizard ON regras_wizard(wizard_id)');
        await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_etapas_wizard_wizard ON etapas_wizard(wizard_id)');
        await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_opcoes_etapa_etapa ON opcoes_etapa(etapa_id)');
        await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_pecas_categoria ON pecas(categoria)');
        await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_wizards_tipo_exame ON wizards(tipo_exame_id)');

        log.debug('Migration v20c: Índices criados');
      } finally {
        await executeNonQuery('PRAGMA foreign_keys = ON');
      }

      log.debug('Migration v20: Concluída (Wizards e Banco de Peças)');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 20', error);
      throw error;
    }
  }

  // Migration versão 21: Categorização de peças com suporte a subcategorias
  if (fromVersion < 21) {
    try {
      await executeNonQuery('PRAGMA foreign_keys = OFF');
      try {
        // --- v21a: Criar tabela categorias_pecas ---
        await executeNonQuery(`
          CREATE TABLE IF NOT EXISTS categorias_pecas (
            id TEXT PRIMARY KEY,
            chave TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL UNIQUE,
            descricao TEXT,
            cor TEXT,
            icone TEXT,
            parent_id TEXT,
            is_sistema INTEGER NOT NULL DEFAULT 0,
            ordem INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES categorias_pecas(id) ON DELETE SET NULL
          )
        `);
        log.debug('Migration v21a: Tabela categorias_pecas criada');

        // --- v21b: Seed de categorias do sistema ---
        const now = new Date().toISOString();
        const catIds: Record<string, string> = {
          armas: 'cat-peca-armas',
          'arma-de-fogo': 'cat-peca-arma-fogo',
          'arma-pressao': 'cat-peca-arma-pressao',
          simulacro: 'cat-peca-simulacro',
          veiculos: 'cat-peca-veiculos',
          carro: 'cat-peca-carro',
          caminhao: 'cat-peca-caminhao',
          reboque: 'cat-peca-reboque',
          semirreboque: 'cat-peca-semirreboque',
          'sem-categoria': 'cat-peca-sem-categoria',
        };

        // Categorias pai primeiro (parent_id NULL)
        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'armas', 'Armas', 'red', 'Crosshair', NULL, 1, 10, ?, ?)
        `, [catIds.armas, now, now]);

        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'veiculos', 'Veículos', 'blue', 'Car', NULL, 1, 20, ?, ?)
        `, [catIds.veiculos, now, now]);

        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'sem_categoria', 'Sem categoria', 'slate', 'Puzzle', NULL, 1, 999, ?, ?)
        `, [catIds['sem-categoria'], now, now]);

        // Subcategorias de Armas
        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'arma_de_fogo', 'Arma de Fogo', 'red', 'Flame', ?, 1, 11, ?, ?)
        `, [catIds['arma-de-fogo'], catIds.armas, now, now]);

        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'arma_de_pressao', 'Arma de Pressão', 'red', 'Wind', ?, 1, 12, ?, ?)
        `, [catIds['arma-pressao'], catIds.armas, now, now]);

        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'simulacro', 'Simulacro', 'red', 'Copy', ?, 1, 13, ?, ?)
        `, [catIds.simulacro, catIds.armas, now, now]);

        // Subcategorias de Veículos
        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'carro', 'Carro', 'blue', 'CarFront', ?, 1, 21, ?, ?)
        `, [catIds.carro, catIds.veiculos, now, now]);

        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'caminhao', 'Caminhão', 'blue', 'Truck', ?, 1, 22, ?, ?)
        `, [catIds.caminhao, catIds.veiculos, now, now]);

        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'reboque', 'Reboque', 'blue', 'Anchor', ?, 1, 23, ?, ?)
        `, [catIds.reboque, catIds.veiculos, now, now]);

        await executeNonQuery(`
          INSERT OR IGNORE INTO categorias_pecas (id, chave, label, cor, icone, parent_id, is_sistema, ordem, created_at, updated_at)
          VALUES (?, 'semirreboque', 'Semirreboque', 'blue', 'Link2', ?, 1, 24, ?, ?)
        `, [catIds.semirreboque, catIds.veiculos, now, now]);

        log.debug('Migration v21b: Categorias de sistema seedadas');

        // --- v21c: Recriar tabela pecas com categoria_id no lugar de categoria ---
        const pecasCols = await executeQuery<{ name: string }>('PRAGMA table_info(pecas)');
        const hasCategoriaId = pecasCols.some(c => c.name === 'categoria_id');
        const hasCategoria = pecasCols.some(c => c.name === 'categoria');

        if (!hasCategoriaId && hasCategoria) {
          // 1. Migrar categorias free-text existentes para a tabela categorias_pecas
          const categoriasUnicas = await executeQuery<{ categoria: string }>(
            "SELECT DISTINCT categoria FROM pecas WHERE categoria IS NOT NULL AND categoria != '' AND ativo = 1"
          );

          for (const row of categoriasUnicas) {
            const catLabel = row.categoria.trim();
            const catChave = catLabel
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .toUpperCase()
              .replace(/\s+/g, '_')
              .replace(/[^A-Z0-9_]/g, '');
            const catId = `cat-peca-user-${catChave.toLowerCase()}`;
            await executeNonQuery(`
              INSERT OR IGNORE INTO categorias_pecas (id, chave, label, is_sistema, ordem, created_at, updated_at)
              VALUES (?, ?, ?, 0, 100, ?, ?)
            `, [catId, catChave, catLabel, now, now]);
          }

          // 2. Recriar tabela pecas com categoria_id
          await executeNonQuery('DROP TABLE IF EXISTS pecas_v21');
          await executeNonQuery(`
            CREATE TABLE pecas_v21 (
              id TEXT PRIMARY KEY,
              nome TEXT NOT NULL,
              descricao TEXT,
              conteudo TEXT NOT NULL,
              categoria_id TEXT,
              tags TEXT,
              ativo INTEGER NOT NULL DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (categoria_id) REFERENCES categorias_pecas(id) ON DELETE SET NULL
            )
          `);

          // 3. Migrar dados: mapear categoria free-text para categoria_id
          await executeNonQuery(`
            INSERT INTO pecas_v21 (id, nome, descricao, conteudo, categoria_id, tags, ativo, created_at, updated_at)
            SELECT
              p.id,
              p.nome,
              p.descricao,
              p.conteudo,
              cp.id AS categoria_id,
              p.tags,
              p.ativo,
              p.created_at,
              p.updated_at
            FROM pecas p
            LEFT JOIN categorias_pecas cp ON (
              cp.label = TRIM(p.categoria)
              AND cp.is_sistema = 0
              AND cp.parent_id IS NULL
            )
          `);

          await executeNonQuery('DROP TABLE pecas');
          await executeNonQuery('ALTER TABLE pecas_v21 RENAME TO pecas');

          log.debug('Migration v21c: Tabela pecas recriada com categoria_id');
        } else {
          log.debug('Migration v21c: Tabela pecas já possui categoria_id, skip');
        }

        // --- v21d: Índices ---
        await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_pecas_categoria_id ON pecas(categoria_id)');
        await executeNonQuery('CREATE INDEX IF NOT EXISTS idx_categorias_pecas_parent ON categorias_pecas(parent_id)');

        log.debug('Migration v21d: Índices criados');
      } finally {
        await executeNonQuery('PRAGMA foreign_keys = ON');
      }

      log.debug('Migration v21: Concluída (Categorização de Peças)');
    } catch (error) {
      log.error('Erro ao aplicar migration versão 21', error);
      throw error;
    }
  }

  // Migration versão 22: Adicionar suporte a subcategorias na tabela categorias_placeholders
  if (fromVersion < 22) {
    try {
      const cols = await executeQuery<{ name: string }>(
        'PRAGMA table_info(categorias_placeholders)'
      );
      const hasParentId = cols.some(c => c.name === 'parent_id');

      if (!hasParentId) {
        await executeNonQuery(
          'ALTER TABLE categorias_placeholders ADD COLUMN parent_id TEXT REFERENCES categorias_placeholders(id) ON DELETE SET NULL'
        );
        await executeNonQuery(
          'CREATE INDEX IF NOT EXISTS idx_categorias_placeholders_parent ON categorias_placeholders(parent_id)'
        );
        log.debug('Migration v22: Coluna parent_id adicionada à tabela categorias_placeholders');
      } else {
        log.debug('Migration v22: Coluna parent_id já existe');
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 22', error);
      throw error;
    }
  }

  // Migration versão 23: Remover colunas nativas da tabela reps que viraram campos_especificos
  if (fromVersion < 23) {
    try {
      const cols = await executeQuery<{ name: string }>(
        'PRAGMA table_info(reps)'
      );
      const colunasARemover = ['nome_envolvido', 'numero_bo', 'numero_ip', 'lacre_entrada', 'lacre_saida'];
      for (const col of colunasARemover) {
        if (cols.some(c => c.name === col)) {
          await executeNonQuery(`ALTER TABLE reps DROP COLUMN ${col}`);
          log.debug(`Migration v23: Coluna '${col}' removida da tabela reps`);
        }
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 23', error);
      throw error;
    }
  }

  // Migration versão 24: Migrar API keys IA para safeStorage (criptografia)
  if (fromVersion < 24) {
    try {
      const { safeStorageService } = await import('../services/safe-storage.service.js');
      if (safeStorageService.isAvailable()) {
        const chavesIA = [
          'api_key_groq',
          'api_key_gemini',
        ];
        let migradas = 0;
        for (const chave of chavesIA) {
          const rows = await executeQuery<{ valor: string | null; tipo: string }>(
            'SELECT valor, tipo FROM configuracoes WHERE chave = ?',
            [chave]
          );
          if (rows.length === 0) continue;
          const { valor, tipo } = rows[0];
          if (valor && tipo !== 'api_key') {
            const encrypted = safeStorageService.encrypt(valor);
            await executeNonQuery(
              'UPDATE configuracoes SET valor = ?, tipo = ? WHERE chave = ?',
              [encrypted, 'api_key', chave]
            );
            migradas++;
          }
        }
        if (migradas > 0) {
          log.debug(`Migration v24: ${migradas} chave(s) IA migrada(s) para safeStorage`);
        }
      } else {
        log.warn('Migration v24: safeStorage indisponível, chaves IA mantidas sem criptografia');
      }
    } catch (error) {
      log.error('Erro ao aplicar migration versão 24', error);
    }
  }

  log.debug(`Aplicadas migrations da versão ${fromVersion}`);
};

/**
 * Testa a conexão com o banco de dados
 */
const testDatabaseConnection = async (): Promise<void> => {
  try {
    const result = await executeQuery<{ test: number }>('SELECT 1 as test');
    if (result[0]?.test === 1) {
      log.debug('Teste de conexão com banco de dados: OK');
    } else {
      throw new Error('Teste de conexão falhou');
    }
  } catch (error) {
    log.error('Teste de conexão com banco de dados falhou', error);
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

    log.debug(`Backup criado: ${backupFilePath}`);
    return backupFilePath;
  } catch (error) {
    log.error('Erro ao criar backup do banco de dados', error);
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
    log.debug(`Backup pré-restauração criado: ${currentBackupPath}`);

    // Restaurar backup
    fs.copyFileSync(backupPath, DB_PATH);

    log.debug(`Banco de dados restaurado de: ${backupPath}`);
  } catch (error) {
    log.error('Erro ao restaurar banco de dados', error);
    throw error;
  }
};

/**
 * Verifica integridade do banco de dados
 */
export const checkDatabaseIntegrity = async (): Promise<boolean> => {
  try {
    // TODO: Implementar verificação real de integridade
    log.debug('Verificação de integridade do banco de dados (mock)');
    return true;
  } catch (error) {
    log.error('Erro ao verificar integridade do banco de dados', error);
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
    log.error('Erro ao obter informações do banco de dados', error);
    return {
      path: DB_PATH,
      size: 0,
      exists: false,
    };
  }
};
