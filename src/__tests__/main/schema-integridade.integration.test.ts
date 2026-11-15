import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sqlite3 from 'sqlite3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'

const tabelasEsperadas = [
  'schema_version', 'users', 'solicitantes', 'tipos_exame', 'reps', 'laudos',
  'imagens_laudo', 'categorias_placeholders', 'placeholders', 'logs_auditoria',
  'templates', 'secoes_template', 'configuracoes', 'wizards', 'etapas_wizard',
  'opcoes_etapa', 'pecas', 'regras_wizard', 'respostas_wizard', 'categorias_pecas',
  'projeteis_personalizados',
]

function executar(database: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => database.run(sql, erro => erro ? reject(erro) : resolve()))
}

function consultarBanco<T>(caminhoBanco: string, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const banco = new sqlite3.Database(caminhoBanco)
    banco.all<T>(sql, (erro, linhas) => {
      banco.close(() => erro ? reject(erro) : resolve(linhas))
    })
  })
}

describe('integridade do schema', () => {
  let diretorioBanco = ''
  let fecharBanco: (() => Promise<void>) | undefined
  let consultar: <T>(sql: string, parametros?: unknown[]) => Promise<T[]>

  beforeAll(async () => {
    diretorioBanco = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-schema-integridade-'))
    vi.mocked(app.getPath).mockReturnValue(diretorioBanco)
    vi.resetModules()

    const database = await import('../../main/database/index.js')
    const sqlite = await import('../../main/database/sqlite.js')
    fecharBanco = sqlite.closeDatabase
    consultar = sqlite.executeQuery
    await database.setupDatabase()
  })

  afterAll(async () => {
    await fecharBanco?.()
    if (diretorioBanco) await fs.rm(diretorioBanco, { recursive: true, force: true })
  })

  it('cria a estrutura completa antes de registrar a versão atual', async () => {
    const tabelas = await consultar<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    const versao = await consultar<{ version: number }>('SELECT MAX(version) AS version FROM schema_version')
    const nomes = new Set(tabelas.map(tabela => tabela.name))

    expect(tabelasEsperadas.every(tabela => nomes.has(tabela))).toBe(true)
    expect(versao[0]?.version).toBe((await import('../../main/database/index.js')).CURRENT_SCHEMA_VERSION)
    const colunasUsuarios = await consultar<{ name: string }>('PRAGMA table_info(users)')
    expect(colunasUsuarios.map(coluna => coluna.name)).toContain('forma_tratamento')
    const colunasImagens = await consultar<{ name: string }>('PRAGMA table_info(imagens_laudo)')
    expect(colunasImagens.map(coluna => coluna.name)).toContain('imagem_origem_id')
    expect(colunasImagens.map(coluna => coluna.name)).toContain('ajustes_json')
    const [schemaRep, schemaLaudo] = await Promise.all([
      consultar<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reps'"),
      consultar<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'laudos'"),
    ])
    expect(schemaRep[0]?.sql).toContain("status IN ('Pendente', 'Em Andamento', 'Concluído')")
    expect(schemaRep[0]?.sql).toContain("data_requisicao GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'")
    expect(schemaLaudo[0]?.sql).toContain("status IN ('Em andamento', 'Concluído', 'Entregue')")
    const indices = await consultar<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")
    expect(indices.map(indice => indice.name)).toEqual(expect.arrayContaining([
      'idx_reps_status_prazo', 'idx_laudos_updated_id', 'idx_logs_auditoria_created_id', 'idx_logs_auditoria_timeline',
    ]))
    const sqlite = await import('../../main/database/sqlite.js')
    await expect(sqlite.executeNonQuery(
      "INSERT INTO reps (id, numero, data_requisicao, status) VALUES ('rep-status-invalido', 'REP-STATUS-INVALIDO', '2026-11-14', 'Cancelado')",
    )).rejects.toThrow()
    await expect(sqlite.executeNonQuery(
      "INSERT INTO reps (id, numero, data_requisicao) VALUES ('rep-data-invalida', 'REP-DATA-INVALIDA', '14/11/2026')",
    )).rejects.toThrow()
  })

  it('persiste a forma de tratamento no perfil do usuário', async () => {
    const { userService } = await import('../../main/services/user.service.js')
    const usuario = await userService.create({
      nome: 'Perita de Teste', email: 'perita@example.test', username: 'perita',
      senha_hash: 'hash-teste', ativo: 1, forma_tratamento: 'feminino',
    })
    expect(usuario.forma_tratamento).toBe('feminino')
    const atualizado = await userService.updateProfile(usuario.id, { forma_tratamento: 'masculino' })
    expect(atualizado?.forma_tratamento).toBe('masculino')
  })

  it('normaliza timestamps técnicos legados para UTC em ISO 8601', async () => {
    await fecharBanco?.()
    const caminhoBanco = path.join(diretorioBanco, 'laudopericial.db')
    const bancoLegado = new sqlite3.Database(caminhoBanco)
    await executar(bancoLegado, 'DROP TRIGGER IF EXISTS trg_solicitantes_timestamp_insercao')
    await executar(bancoLegado, 'DROP TRIGGER IF EXISTS trg_solicitantes_timestamp_edicao')
    await executar(bancoLegado, "INSERT INTO solicitantes (id, nome, tipo, created_at, updated_at) VALUES ('solicitante-v51', 'Solicitante v51', 'Unidade', '2026-11-14 22:00:00', '2026-11-14 22:00:00')")
    await executar(bancoLegado, 'DELETE FROM schema_version')
    await executar(bancoLegado, 'INSERT INTO schema_version (version) VALUES (50)')
    await new Promise<void>((resolve, reject) => bancoLegado.close(erro => erro ? reject(erro) : resolve()))

    vi.resetModules()
    const database = await import('../../main/database/index.js')
    const sqlite = await import('../../main/database/sqlite.js')
    fecharBanco = sqlite.closeDatabase
    consultar = sqlite.executeQuery
    await database.setupDatabase()

    expect(await consultar<{ created_at: string; updated_at: string }>("SELECT created_at, updated_at FROM solicitantes WHERE id = 'solicitante-v51'")).toEqual([
      { created_at: '2026-11-14T22:00:00.000Z', updated_at: '2026-11-14T22:00:00.000Z' },
    ])
  })

  it('repara o banco v32 incompleto criado pela v0.1.7 sem apagar o banco', async () => {
    await fecharBanco?.()
    const bancoLegado = new sqlite3.Database(path.join(diretorioBanco, 'laudopericial.db'))
    for (const tabela of ['configuracoes', 'respostas_wizard', 'regras_wizard', 'opcoes_etapa', 'etapas_wizard', 'wizards', 'categorias_pecas']) {
      await executar(bancoLegado, `DROP TABLE ${tabela}`)
    }
    await executar(bancoLegado, 'DROP TABLE projeteis_personalizados')
    await executar(bancoLegado, 'DELETE FROM schema_version')
    await executar(bancoLegado, 'INSERT INTO schema_version (version) VALUES (32)')
    await new Promise<void>((resolve, reject) => bancoLegado.close(erro => erro ? reject(erro) : resolve()))

    vi.resetModules()
    const database = await import('../../main/database/index.js')
    const sqlite = await import('../../main/database/sqlite.js')
    fecharBanco = sqlite.closeDatabase
    consultar = sqlite.executeQuery
    await database.setupDatabase()

    const tabelas = await consultar<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    const nomes = new Set(tabelas.map(tabela => tabela.name))
    expect(tabelasEsperadas.every(tabela => nomes.has(tabela))).toBe(true)
  })

  it('reconcilia colunas ausentes ao atualizar da versão anterior', async () => {
    await fecharBanco?.()
    const bancoLegado = new sqlite3.Database(path.join(diretorioBanco, 'laudopericial.db'))
    await executar(bancoLegado, "INSERT INTO logs_auditoria (acao, entidade, detalhes) VALUES ('evento legado', 'reps', 'preservar')")
    await executar(bancoLegado, 'DROP INDEX IF EXISTS idx_logs_auditoria_modulo')
    await executar(bancoLegado, 'DROP INDEX IF EXISTS idx_logs_auditoria_timeline')
    await executar(bancoLegado, 'ALTER TABLE logs_auditoria DROP COLUMN modulo')
    await executar(bancoLegado, 'ALTER TABLE laudos DROP COLUMN tipo_criacao')
    await executar(bancoLegado, 'DELETE FROM schema_version')
    await executar(bancoLegado, 'INSERT INTO schema_version (version) VALUES (38)')
    await new Promise<void>((resolve, reject) => bancoLegado.close(erro => erro ? reject(erro) : resolve()))

    vi.resetModules()
    const database = await import('../../main/database/index.js')
    const sqlite = await import('../../main/database/sqlite.js')
    fecharBanco = sqlite.closeDatabase
    consultar = sqlite.executeQuery
    await database.setupDatabase()

    const logs = await consultar<{ name: string }>('PRAGMA table_info(logs_auditoria)')
    const laudos = await consultar<{ name: string }>('PRAGMA table_info(laudos)')
    const indicesLaudos = await consultar<{ name: string; unique: number }>('PRAGMA index_list(laudos)')
    expect(logs.some(coluna => coluna.name === 'modulo')).toBe(true)
    expect(laudos.some(coluna => coluna.name === 'tipo_criacao')).toBe(true)
    expect(indicesLaudos.some(indice => indice.unique === 1 && indice.name.includes('rep_id'))).toBe(false)

    const eventosPreservados = await consultar<{ detalhes: string }>('SELECT detalhes FROM logs_auditoria WHERE detalhes = ?', ['preservar'])
    expect(eventosPreservados).toEqual([{ detalhes: 'preservar' }])

    const diretorioSnapshots = path.join(diretorioBanco, 'backups-migracoes')
    const snapshots = await fs.readdir(diretorioSnapshots)
    expect(snapshots).not.toHaveLength(0)
    const snapshotMaisRecente = path.join(diretorioSnapshots, snapshots.sort().at(-1) ?? '')
    const colunasNoSnapshot = await consultarBanco<{ name: string }>(snapshotMaisRecente, 'PRAGMA table_info(logs_auditoria)')
    expect(colunasNoSnapshot.some(coluna => coluna.name === 'modulo')).toBe(false)
  })

  it('recusa banco de versão futura sem tentar repará-lo', async () => {
    await fecharBanco?.()
    const versaoFutura = (await import('../../main/database/index.js')).CURRENT_SCHEMA_VERSION + 1
    const bancoFuturo = new sqlite3.Database(path.join(diretorioBanco, 'laudopericial.db'))
    await executar(bancoFuturo, 'DELETE FROM schema_version')
    await executar(bancoFuturo, `INSERT INTO schema_version (version) VALUES (${versaoFutura})`)
    await new Promise<void>((resolve, reject) => bancoFuturo.close(erro => erro ? reject(erro) : resolve()))

    vi.resetModules()
    const database = await import('../../main/database/index.js')
    const sqlite = await import('../../main/database/sqlite.js')
    fecharBanco = sqlite.closeDatabase

    await expect(database.setupDatabase()).rejects.toThrow('SCHEMA_FUTURO_INCOMPATIVEL')
    await fecharBanco()
    const versaoPersistida = await consultarBanco<{ version: number }>(path.join(diretorioBanco, 'laudopericial.db'), 'SELECT version FROM schema_version')
    expect(versaoPersistida).toEqual([{ version: versaoFutura }])
  })

  it('recusa dados históricos inválidos sem avançar a migration v50', async () => {
    const caminhoBanco = path.join(diretorioBanco, 'laudopericial.db')
    const bancoLegado = new sqlite3.Database(caminhoBanco)
    await executar(bancoLegado, 'PRAGMA ignore_check_constraints = ON')
    await executar(bancoLegado, "INSERT INTO reps (id, numero, data_requisicao) VALUES ('rep-data-invalida-v50', 'REP-V50', '31/02/2026')")
    await executar(bancoLegado, 'DELETE FROM schema_version')
    await executar(bancoLegado, 'INSERT INTO schema_version (version) VALUES (49)')
    await new Promise<void>((resolve, reject) => bancoLegado.close(erro => erro ? reject(erro) : resolve()))

    vi.resetModules()
    const database = await import('../../main/database/index.js')
    const sqlite = await import('../../main/database/sqlite.js')
    fecharBanco = sqlite.closeDatabase
    await expect(database.setupDatabase()).rejects.toThrow('SCHEMA_INCOMPATIVEL')
    await fecharBanco()
    expect(await consultarBanco<{ version: number }>(caminhoBanco, 'SELECT version FROM schema_version')).toEqual([{ version: 49 }])
    const snapshots = await fs.readdir(path.join(diretorioBanco, 'backups-migracoes'))
    expect(snapshots.some(snapshot => snapshot.includes('-v51.db'))).toBe(true)
  })
})
