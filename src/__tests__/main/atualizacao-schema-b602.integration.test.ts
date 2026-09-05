import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'

describe('fluxo B-602 após atualização de schema', () => {
  let diretorioBanco = ''
  let fecharBanco: () => Promise<void>
  let executar: (sql: string, parametros?: unknown[]) => Promise<void>
  let consultar: <T>(sql: string, parametros?: unknown[]) => Promise<T[]>
  let criarLaudoInicial: (parametros: { rep_id: string; perito_id: string; template_id: string }) => Promise<{ id: string; conteudo: string; tipo_criacao?: string }>
  let obterLinhaDoTempo: (repId: string) => Promise<{ success: boolean; data?: Record<string, unknown>[] }>
  let auditarCicloVida: (usuarioId: string, modulo: 'rep' | 'laudo', entidadeId: string, tipoAcao: 'criacao' | 'atualizacao' | 'exclusao' | 'transicao_status', mensagem: string) => void

  beforeAll(async () => {
    diretorioBanco = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-b602-schema-'))
    vi.mocked(app.getPath).mockReturnValue(diretorioBanco)
    vi.resetModules()

    const database = await import('../../main/database/index.js')
    const sqlite = await import('../../main/database/sqlite.js')
    const laudo = await import('../../main/services/laudo.service.js')
    const auditoria = await import('../../main/services/audit-log.service.js')
    fecharBanco = sqlite.closeDatabase
    executar = sqlite.executeNonQuery
    consultar = sqlite.executeQuery
    criarLaudoInicial = parametros => laudo.laudoService.criarLaudoInicial(parametros)
    obterLinhaDoTempo = auditoria.getTimelineRep
    auditarCicloVida = auditoria.auditCicloVida
    await database.setupDatabase()
  })

  afterAll(async () => {
    await fecharBanco?.()
    if (diretorioBanco) await fs.rm(diretorioBanco, { recursive: true, force: true })
  })

  it('cria laudo pelo template integrado B-602 e o expõe na linha do tempo', async () => {
    const [tipoB602] = await consultar<{ id: string }>('SELECT id FROM tipos_exame WHERE codigo = ?', ['B-602'])
    const [templateB602] = await consultar<{ id: string; nome: string }>(
      "SELECT id, nome FROM templates WHERE chave_integrada = 'laudo-padrao-b602' AND disponivel_novos_laudos = 1",
    )
    expect(tipoB602).toBeDefined()
    expect(templateB602).toMatchObject({ nome: 'Laudo Padrão B-602' })

    await executar(
      'INSERT INTO users (id, nome, email, username, senha_hash) VALUES (?, ?, ?, ?, ?)',
      ['perito-b602', 'Perito de teste', 'perito-b602@teste.local', 'perito-b602', 'hash'],
    )
    await executar(
      'INSERT INTO reps (id, numero, tipo_exame_id, usuario_id, data_requisicao, campos_especificos) VALUES (?, ?, ?, ?, ?, ?)',
      ['rep-b602', 'B602-ATUALIZACAO-001', tipoB602.id, 'perito-b602', '2026-09-04', JSON.stringify({ b602: { pecas: [] } })],
    )

    const laudo = await criarLaudoInicial({ rep_id: 'rep-b602', perito_id: 'perito-b602', template_id: templateB602.id })
    auditarCicloVida('perito-b602', 'laudo', laudo.id, 'criacao', 'Laudo B-602 criado após atualização')

    await vi.waitFor(async () => {
      const linhaDoTempo = await obterLinhaDoTempo('rep-b602')
      expect(linhaDoTempo.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ entidade_id: laudo.id, modulo: 'laudo', origem: 'Laudo' }),
      ]))
    })

    expect(laudo.tipo_criacao).toBe('template')
    expect(laudo.conteudo).toContain('MATERIAL APRESENTADO A EXAME')
    expect(laudo.conteudo).not.toContain('DAS ARMAS')
  })
})
