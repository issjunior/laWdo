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

describe('migration de imagens legadas', () => {
  let diretorioBanco = ''
  let fecharBanco: (() => Promise<void>) | undefined
  let consultar: <T>(sql: string, parametros?: unknown[]) => Promise<T[]>

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
    consultar = sqlite.executeQuery
    await database.setupDatabase()
  })

  afterAll(async () => {
    await fecharBanco?.()
    if (diretorioBanco) await fs.rm(diretorioBanco, { recursive: true, force: true })
  })

  it('converte caminho legado para o armazenamento organizado sem perder a imagem', async () => {
    const colunas = await consultar<{ name: string }>('PRAGMA table_info(imagens_laudo)')
    const [imagem] = await consultar<{ caminho_relativo: string; mime_type: string; tamanho: number }>(
      'SELECT caminho_relativo, mime_type, tamanho FROM imagens_laudo WHERE id = ?',
      ['imagem-legada-1'],
    )

    expect(colunas.map(coluna => coluna.name)).toContain('caminho_relativo')
    expect(colunas.map(coluna => coluna.name)).toContain('disponivel_painel')
    expect(imagem).toMatchObject({ mime_type: 'image/jpeg', tamanho: 4 })
    await expect(fs.access(path.join(diretorioBanco, imagem.caminho_relativo))).resolves.toBeUndefined()
  })
})
