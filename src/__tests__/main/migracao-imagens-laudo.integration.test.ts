import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sqlite3 from 'sqlite3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'

function executar(database: sqlite3.Database, sql: string, parametros: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run(sql, parametros, erro => erro ? reject(erro) : resolve())
  })
}

describe('banco legado incompleto', () => {
  let diretorioBanco = ''
  let fecharBanco: (() => Promise<void>) | undefined
  let erroInicializacao: unknown

  beforeAll(async () => {
    diretorioBanco = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-imagens-legadas-'))
    vi.mocked(app.getPath).mockReturnValue(diretorioBanco)
    const caminhoImagemLegada = path.join(diretorioBanco, 'imagens', 'laudo-legado-1', 'foto.jpg')
    await fs.mkdir(path.dirname(caminhoImagemLegada), { recursive: true })
    await fs.writeFile(caminhoImagemLegada, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))

    const bancoLegado = new sqlite3.Database(path.join(diretorioBanco, 'laudopericial.db'))
    await executar(bancoLegado, 'CREATE TABLE schema_version (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
    await executar(bancoLegado, 'INSERT INTO schema_version (version) VALUES (28)')
    await executar(bancoLegado, 'CREATE TABLE laudos (id TEXT PRIMARY KEY)')
    await executar(bancoLegado, 'INSERT INTO laudos (id) VALUES (?)', ['laudo-legado-1'])
    await executar(bancoLegado, `
      CREATE TABLE imagens_laudo (
        id TEXT PRIMARY KEY,
        laudo_id TEXT NOT NULL,
        caminho TEXT NOT NULL,
        legenda TEXT NOT NULL,
        numero_figura INTEGER NOT NULL,
        sequencia INTEGER NOT NULL DEFAULT 0,
        latitude REAL,
        longitude REAL,
        data_captura DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await executar(
      bancoLegado,
      'INSERT INTO imagens_laudo (id, laudo_id, caminho, legenda, numero_figura, sequencia) VALUES (?, ?, ?, ?, ?, ?)',
      ['imagem-legada-1', 'laudo-legado-1', caminhoImagemLegada, 'Foto legada', 1, 1],
    )
    await new Promise<void>((resolve, reject) => bancoLegado.close(erro => erro ? reject(erro) : resolve()))

    vi.resetModules()
    const database = await import('../../main/database/index.js')
    const sqlite = await import('../../main/database/sqlite.js')
    fecharBanco = sqlite.closeDatabase
    try {
      await database.setupDatabase()
    } catch (erro) {
      erroInicializacao = erro
    }
  })

  afterAll(async () => {
    await fecharBanco?.()
    if (diretorioBanco) await fs.rm(diretorioBanco, { recursive: true, force: true })
  })

  it('bloqueia a inicialização e preserva os dados quando faltam estruturas obrigatórias', async () => {
    expect(erroInicializacao).toBeInstanceOf(Error)
    expect(erroInicializacao).toMatchObject({ message: expect.stringContaining('SCHEMA_INCOMPATIVEL') })
  })

})

describe('migração de imagem legada em banco íntegro', () => {
  it('converte caminho legado para o armazenamento organizado sem perder a imagem', async () => {
    const diretorioBanco = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-migracao-imagem-'))
    let fecharBanco: (() => Promise<void>) | undefined

    try {
      vi.mocked(app.getPath).mockReturnValue(diretorioBanco)
      vi.resetModules()
      const bancoAtual = await import('../../main/database/index.js')
      const sqliteAtual = await import('../../main/database/sqlite.js')
      await bancoAtual.setupDatabase()
      await sqliteAtual.closeDatabase()

      const caminhoImagemLegada = path.join(diretorioBanco, 'imagens', 'laudo-legado-1', 'foto.jpg')
      await fs.mkdir(path.dirname(caminhoImagemLegada), { recursive: true })
      await fs.writeFile(caminhoImagemLegada, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))

      const bancoLegado = new sqlite3.Database(path.join(diretorioBanco, 'laudopericial.db'))
      await executar(bancoLegado, "INSERT INTO users (id, nome, email, username, senha_hash) VALUES ('perito-legado-1', 'Perito', 'perito@teste.local', 'perito', 'hash')")
      await executar(bancoLegado, "INSERT INTO reps (id, numero, data_requisicao) VALUES ('rep-legada-1', '1/2026', '2026-01-01')")
      await executar(bancoLegado, "INSERT INTO laudos (id, rep_id, perito_id, template_id, conteudo) VALUES ('laudo-legado-1', 'rep-legada-1', 'perito-legado-1', 'tpl-nao-definido', '<p>Laudo legado</p>')")
      await executar(bancoLegado, 'DROP TABLE imagens_laudo')
      await executar(bancoLegado, `
        CREATE TABLE imagens_laudo (
          id TEXT PRIMARY KEY,
          laudo_id TEXT NOT NULL,
          caminho TEXT NOT NULL,
          legenda TEXT NOT NULL,
          numero_figura INTEGER NOT NULL,
          sequencia INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await executar(
        bancoLegado,
        'INSERT INTO imagens_laudo (id, laudo_id, caminho, legenda, numero_figura, sequencia) VALUES (?, ?, ?, ?, ?, ?)',
        ['imagem-legada-1', 'laudo-legado-1', caminhoImagemLegada, 'Foto legada', 1, 1],
      )
      await executar(bancoLegado, 'DELETE FROM schema_version')
      await executar(bancoLegado, 'INSERT INTO schema_version (version) VALUES (28)')
      await new Promise<void>((resolve, reject) => bancoLegado.close(erro => erro ? reject(erro) : resolve()))

      vi.resetModules()
      const database = await import('../../main/database/index.js')
      const sqlite = await import('../../main/database/sqlite.js')
      fecharBanco = sqlite.closeDatabase
      await database.setupDatabase()

      const colunas = await sqlite.executeQuery<{ name: string }>('PRAGMA table_info(imagens_laudo)')
      const [imagem] = await sqlite.executeQuery<{ caminho_relativo: string; mime_type: string; tamanho: number }>(
        'SELECT caminho_relativo, mime_type, tamanho FROM imagens_laudo WHERE id = ?',
        ['imagem-legada-1'],
      )

      expect(colunas.map(coluna => coluna.name)).toContain('caminho_relativo')
      expect(colunas.map(coluna => coluna.name)).toContain('disponivel_painel')
      expect(imagem).toMatchObject({ mime_type: 'image/jpeg', tamanho: 4 })
      await expect(fs.access(path.join(diretorioBanco, imagem.caminho_relativo))).resolves.toBeUndefined()
    } finally {
      await fecharBanco?.()
      await fs.rm(diretorioBanco, { recursive: true, force: true })
    }
  })
})
