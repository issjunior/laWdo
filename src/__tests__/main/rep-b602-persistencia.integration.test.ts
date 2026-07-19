import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app, ipcMain } from 'electron'
import type { MetadadosIntegracaoGdl, PecaB602 } from '../../shared/types/b602-gdl.types'
import type { REPFormData } from '../../renderer/components/rep/exam-fields/types'
import {
  deserializeCamposEspecificos,
  serializeCamposEspecificos,
} from '../../renderer/components/rep/exam-fields'
import {
  extrairMetadadosIntegracaoGdl,
  extrairPecasB602,
} from '../../renderer/components/rep/exam-fields/integracao-gdl-b602.utils'
import { mesclarPecasB602DoGdl } from '../../renderer/components/rep/exam-fields/pecas-b602.utils'

vi.mock('../../main/services/audit-log.service.js', () => ({
  auditCicloVida: vi.fn(),
  auditDelete: vi.fn(),
}))

vi.mock('../../main/services/laudo.service.js', () => ({
  laudoService: {
    criarLaudoInicial: vi.fn(),
    deletarPorRepId: vi.fn(),
    findByRepId: vi.fn().mockResolvedValue(null),
    sincronizarSecoesCondicionais: vi.fn(),
    update: vi.fn(),
  },
}))

interface ResultadoIpc<T> {
  success: boolean
  data?: T
  error?: string
}

interface RepPersistida {
  id: string
  campos_especificos?: string
}

type HandlerIpc = (...args: unknown[]) => Promise<ResultadoIpc<RepPersistida>>

const handlers = new Map<string, HandlerIpc>()
let diretorioBanco = ''
let closeDatabase: (() => Promise<void>) | undefined

function criarFormulario(campos: Partial<REPFormData>): REPFormData {
  return new Proxy(campos, {
    get(alvo, propriedade: string) {
      return alvo[propriedade] ?? ''
    },
  }) as REPFormData
}

function criarPeca(
  idLocal: string,
  codPecaGdl: number,
  identificacao: string,
): PecaB602 {
  return {
    idLocal,
    origem: 'gdl',
    alteradaLocalmente: false,
    codPecaGdl,
    tipoCodigo: '476',
    tipoPeca: 'CARABINA(S)',
    comuns: {
      identificacao,
      numeroAnalises: '',
      quantidade: 1,
      unidadeMedida: 'UNIDADE',
      quantidadeDescricao: '',
      examinadoInLoco: false,
      dataEntrada: '',
      lacreEntrada: '',
      lacreSaida: '',
      dataLiberacao: '',
      codigoVestigio: '',
      consumida: 'N',
      observacao: '',
    },
    personalizados: { '476:numero-serie': `SERIE-${codPecaGdl}` },
    extrasGdl: {},
  }
}

const metadados: MetadadosIntegracaoGdl = {
  origemInicial: 'gdl',
  dadosSolicitacao: {
    orgao: 'UNIDADE POLICIAL TESTE',
    responsavel: 'RESPONSÁVEL TESTE',
    autoridade: 'AUTORIDADE TESTE',
    origensDisponiveis: [{ tipo: 'BO', numero: '123/2026' }],
  },
  dadosInvestigacao: {
    envolvidos: ['ENVOLVIDO TESTE'],
    boletinsOcorrencia: [{ tipo: 'BO', numero: '123/2026' }],
    inqueritosPoliciais: [],
  },
}

beforeAll(async () => {
  diretorioBanco = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-b602-'))
  vi.mocked(app.getPath).mockReturnValue(diretorioBanco)
  vi.mocked(ipcMain.handle).mockImplementation((canal, handler) => {
    handlers.set(canal, handler as HandlerIpc)
    return undefined
  })

  vi.resetModules()
  const database = await import('../../main/database/index.js')
  const sqlite = await import('../../main/database/sqlite.js')
  const { registerRepHandlers } = await import('../../main/ipc/handlers/rep.handlers.js')

  closeDatabase = sqlite.closeDatabase
  await database.setupDatabase()
  registerRepHandlers()
})

afterAll(async () => {
  await closeDatabase?.()
  if (diretorioBanco) {
    await fs.rm(diretorioBanco, { recursive: true, force: true })
  }
})

describe('persistência B602 por IPC e SQLite', () => {
  it('persiste e reabre as reconciliações Mesclar e Substituir no formato canônico', async () => {
    const pecaEditadaLocalmente = criarPeca('peca-gdl-1', 1001, 'CARABINA EDITADA LOCALMENTE')
    pecaEditadaLocalmente.alteradaLocalmente = true
    const pecaImportadaRemovivel = criarPeca('peca-gdl-2', 1002, 'CARABINA IMPORTADA REMOVÍVEL')
    const pecaManual: PecaB602 = {
      ...criarPeca('peca-manual', 9001, 'CARABINA MANUAL'),
      origem: 'manual',
      codPecaGdl: undefined,
      alteradaLocalmente: true,
    }
    const pecasIniciais = [pecaEditadaLocalmente, pecaImportadaRemovivel, pecaManual]
    const camposIniciais = serializeCamposEspecificos(
      'B-602',
      criarFormulario({ b602_solicitante_nome: 'UNIDADE POLICIAL TESTE' }),
      { b602: { pecas: pecasIniciais, metadadosIntegracaoGdl: metadados } },
    )
    const criar = handlers.get('rep:create')
    const buscar = handlers.get('rep:findById')
    const atualizar = handlers.get('rep:update')

    expect(criar).toBeDefined()
    expect(buscar).toBeDefined()
    expect(atualizar).toBeDefined()

    const criacao = await criar?.({}, {
      numero: 'B602-IPC-001/2026',
      data_requisicao: '2026-07-19',
      campos_especificos: camposIniciais,
    })

    expect(criacao).toMatchObject({ success: true })
    const repId = criacao?.data?.id
    expect(repId).toBeTruthy()

    const reabertaAposCriacao = await buscar?.({}, repId)
    expect(reabertaAposCriacao).toMatchObject({ success: true })
    expect(extrairPecasB602(reabertaAposCriacao?.data?.campos_especificos)).toEqual(pecasIniciais)
    expect(extrairMetadadosIntegracaoGdl(reabertaAposCriacao?.data?.campos_especificos)).toEqual(metadados)

    const pecaRecebidaAtualizada = criarPeca('peca-retornada-1', 1001, 'CARABINA ATUALIZADA PELO GDL')
    const pecaNovaRecebida = criarPeca('peca-retornada-3', 1003, 'CARABINA NOVA DO GDL')
    const pecasMescladas = mesclarPecasB602DoGdl(
      extrairPecasB602(reabertaAposCriacao?.data?.campos_especificos),
      [pecaRecebidaAtualizada, pecaNovaRecebida],
      false,
    )
    const camposMesclados = serializeCamposEspecificos(
      'B-602',
      criarFormulario({ b602_solicitante_nome: 'UNIDADE POLICIAL TESTE' }),
      { b602: { pecas: pecasMescladas, metadadosIntegracaoGdl: metadados } },
    )

    const atualizacaoMesclar = await atualizar?.({}, repId, { campos_especificos: camposMesclados })
    expect(atualizacaoMesclar).toMatchObject({ success: true })

    const reabertaAposMesclar = await buscar?.({}, repId)
    expect(extrairPecasB602(reabertaAposMesclar?.data?.campos_especificos)).toEqual([
      pecaEditadaLocalmente,
      pecaImportadaRemovivel,
      pecaManual,
      pecaNovaRecebida,
    ])
    expect(extrairMetadadosIntegracaoGdl(reabertaAposMesclar?.data?.campos_especificos)).toEqual(metadados)

    const pecaSelecionadaNaSubstituicao = criarPeca(
      'peca-retornada-substituicao',
      1001,
      'CARABINA SUBSTITUÍDA PELO GDL',
    )
    const pecasSubstituidas = mesclarPecasB602DoGdl(
      extrairPecasB602(reabertaAposMesclar?.data?.campos_especificos),
      [pecaSelecionadaNaSubstituicao],
      true,
      true,
      [pecaSelecionadaNaSubstituicao],
    )
    const camposSubstituidos = serializeCamposEspecificos(
      'B-602',
      criarFormulario({ b602_solicitante_nome: 'UNIDADE POLICIAL TESTE' }),
      { b602: { pecas: pecasSubstituidas, metadadosIntegracaoGdl: metadados } },
    )

    const atualizacaoSubstituir = await atualizar?.({}, repId, { campos_especificos: camposSubstituidos })
    expect(atualizacaoSubstituir).toMatchObject({ success: true })

    const reabertaAposSubstituir = await buscar?.({}, repId)
    const persistido = JSON.parse(reabertaAposSubstituir?.data?.campos_especificos ?? '{}') as {
      b602?: Record<string, unknown>
    }

    expect(extrairPecasB602(reabertaAposSubstituir?.data?.campos_especificos)).toEqual([
      { ...pecaSelecionadaNaSubstituicao, idLocal: pecaEditadaLocalmente.idLocal },
      pecaManual,
    ])
    expect(extrairMetadadosIntegracaoGdl(reabertaAposSubstituir?.data?.campos_especificos)).toEqual(metadados)
    expect(deserializeCamposEspecificos('B-602', reabertaAposSubstituir?.data?.campos_especificos))
      .toMatchObject({ b602_solicitante_nome: 'UNIDADE POLICIAL TESTE' })
    expect(persistido.b602).not.toHaveProperty('material_enc')
    expect(persistido.b602).not.toHaveProperty('cartuchos')
    expect(persistido.b602).not.toHaveProperty('estojos')
    expect(persistido.b602).not.toHaveProperty('armas')
  })
})
