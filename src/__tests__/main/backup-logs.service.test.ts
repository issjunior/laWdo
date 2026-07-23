import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sqlite3 from 'sqlite3'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const diretorioDados = path.join(os.tmpdir(), 'lawdo-backup-logs-test')
const caminhoBanco = path.join(diretorioDados, 'laudopericial.db')

const mocks = vi.hoisted(() => ({
  closeDatabase: vi.fn(),
  executeNonQuery: vi.fn(),
  executeQuery: vi.fn(),
  relaunch: vi.fn(),
  exit: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => path.join(os.tmpdir(), 'lawdo-backup-logs-test'),
    relaunch: mocks.relaunch,
    exit: mocks.exit,
  },
}))

vi.mock('adm-zip', () => ({
  default: class AdmZipMock {
    addFile(): void {}

    addLocalFile(): void {}

    writeZip(): void {}

    extractAllTo(): void {}

    getEntries(): Array<{ entryName: string; getData: () => Buffer }> {
      return [
        { entryName: 'laudopericial.db', getData: () => Buffer.alloc(0) },
        {
          entryName: 'manifesto.json',
          getData: () => Buffer.from(JSON.stringify({
            formato: 2,
            criadoEm: '2026-07-23T00:00:00.000Z',
            imagens: [],
          }), 'utf8'),
        },
      ]
    }

    getEntry(nome: string): { getData: () => Buffer } | null {
      if (nome === 'manifest.json') {
        return {
          getData: () => Buffer.from(JSON.stringify({
            version: 1,
            tipo: 'config',
            data: '2026-07-23T00:00:00.000Z',
            tabelas: ['solicitantes'],
          }), 'utf8'),
        }
      }
      if (nome === 'solicitantes.json') {
        return { getData: () => Buffer.from('[]', 'utf8') }
      }
      return null
    }
  },
}))

vi.mock('../../main/database/sqlite.js', () => ({
  closeDatabase: (...args: unknown[]) => mocks.closeDatabase(...args),
  executeNonQuery: (...args: unknown[]) => mocks.executeNonQuery(...args),
  executeQuery: (...args: unknown[]) => mocks.executeQuery(...args),
  withTransaction: async (fn: () => Promise<unknown>) => fn(),
}))

vi.mock('../../main/utils/logger.js', () => ({
  getLogger: () => ({
    debug: mocks.debug,
    info: mocks.info,
    warn: mocks.warn,
    error: mocks.error,
  }),
}))

import { criarBackup, restaurarBackup } from '../../main/services/backup.service'
import { exportarConfig, importarConfig } from '../../main/services/config-backup.service'

async function criarBancoTeste(): Promise<void> {
  fs.mkdirSync(diretorioDados, { recursive: true })
  if (fs.existsSync(caminhoBanco)) fs.unlinkSync(caminhoBanco)

  const banco = new sqlite3.Database(caminhoBanco)
  await new Promise<void>((resolve, reject) => {
    banco.exec(
      'CREATE TABLE logs_auditoria (id INTEGER PRIMARY KEY, modulo TEXT);',
      erro => erro ? reject(erro) : resolve(),
    )
  })
  await new Promise<void>((resolve, reject) => {
    banco.close(erro => erro ? reject(erro) : resolve())
  })
}

describe('logs operacionais de backup', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.executeNonQuery.mockResolvedValue(undefined)
    mocks.executeQuery.mockResolvedValue([])
    mocks.closeDatabase.mockResolvedValue(undefined)
    await criarBancoTeste()
  })

  afterAll(() => {
    const raizTemporaria = path.resolve(os.tmpdir())
    const destino = path.resolve(diretorioDados)
    if (destino.startsWith(`${raizTemporaria}${path.sep}`) && fs.existsSync(destino)) {
      fs.rmSync(destino, { recursive: true, force: true })
    }
  })

  it('registra criação e restauração do backup completo', async () => {
    const caminhoBackup = path.join(diretorioDados, 'backup-completo.zip')

    await expect(criarBackup(caminhoBackup)).resolves.toEqual({
      success: true,
      path: caminhoBackup,
    })
    expect(mocks.info).toHaveBeenCalledWith('Backup completo criado com sucesso', {
      destino: caminhoBackup,
    })

    const caminhoRestauracao = path.join(diretorioDados, 'restauracao-completa.zip')
    fs.writeFileSync(caminhoRestauracao, '')

    mocks.info.mockClear()
    await expect(restaurarBackup(caminhoRestauracao)).resolves.toEqual({ success: true })
    expect(mocks.info).toHaveBeenCalledWith('Backup completo restaurado com sucesso', {
      origem: caminhoRestauracao,
    })
  })

  it('inclui o motivo na mensagem de falha do backup completo', async () => {
    fs.unlinkSync(caminhoBanco)

    const resultado = await criarBackup(path.join(diretorioDados, 'invalido.zip'))

    expect(resultado).toEqual({
      success: false,
      error: 'Banco de dados não encontrado para backup',
    })
    expect(mocks.error).toHaveBeenCalledWith(
      'Falha ao criar backup completo: Banco de dados não encontrado para backup',
      expect.any(Error),
    )
  })

  it('inclui o motivo na mensagem de falha da restauração completa', async () => {
    const caminhoInexistente = path.join(diretorioDados, 'restauracao-inexistente.zip')

    const resultado = await restaurarBackup(caminhoInexistente)

    expect(resultado).toEqual({
      success: false,
      error: 'Arquivo de backup não encontrado',
    })
    expect(mocks.error).toHaveBeenCalledWith(
      'Falha ao restaurar backup completo: Arquivo de backup não encontrado',
      expect.any(Error),
    )
  })

  it('registra criação e importação do backup de configurações', async () => {
    const caminhoBackup = path.join(diretorioDados, 'backup-configuracoes.zip')

    await expect(exportarConfig(caminhoBackup)).resolves.toEqual({
      success: true,
      path: caminhoBackup,
    })
    expect(mocks.info).toHaveBeenCalledWith('Backup de configurações criado com sucesso', {
      destino: caminhoBackup,
    })

    const caminhoImportacao = path.join(diretorioDados, 'importacao-configuracoes.zip')
    fs.writeFileSync(caminhoImportacao, '')

    mocks.info.mockClear()
    await expect(importarConfig(caminhoImportacao)).resolves.toEqual({ success: true })
    expect(mocks.info).toHaveBeenCalledWith('Backup de configurações importado com sucesso', {
      origem: caminhoImportacao,
    })
  })

  it('inclui o motivo na mensagem de falha da criação do backup de configurações', async () => {
    mocks.executeQuery.mockRejectedValueOnce(new Error('Falha simulada na leitura'))

    const resultado = await exportarConfig(path.join(diretorioDados, 'configuracoes-invalidas.zip'))

    expect(resultado).toEqual({
      success: false,
      error: 'Falha simulada na leitura',
    })
    expect(mocks.error).toHaveBeenCalledWith(
      'Falha ao criar backup de configurações: Falha simulada na leitura',
      expect.any(Error),
    )
  })

  it('inclui o motivo na mensagem de falha da importação de configurações', async () => {
    const caminhoInexistente = path.join(diretorioDados, 'configuracoes-inexistentes.zip')

    const resultado = await importarConfig(caminhoInexistente)

    expect(resultado).toEqual({
      success: false,
      error: 'Arquivo de backup nao encontrado',
    })
    expect(mocks.error).toHaveBeenCalledWith(
      'Falha ao importar backup de configurações: Arquivo de backup nao encontrado',
      expect.any(Error),
    )
  })
})
