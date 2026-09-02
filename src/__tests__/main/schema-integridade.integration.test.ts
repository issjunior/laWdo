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
]

function executar(database: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => database.run(sql, erro => erro ? reject(erro) : resolve()))
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
    expect(versao[0]?.version).toBe(33)
  })

  it('repara o banco v32 incompleto criado pela v0.1.7 sem apagar o banco', async () => {
    await fecharBanco?.()
    const bancoLegado = new sqlite3.Database(path.join(diretorioBanco, 'laudopericial.db'))
    for (const tabela of ['configuracoes', 'respostas_wizard', 'regras_wizard', 'opcoes_etapa', 'etapas_wizard', 'wizards', 'categorias_pecas']) {
      await executar(bancoLegado, `DROP TABLE ${tabela}`)
    }
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
})
