import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaudoRow, REPRow } from '../../main/types/database'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '../../shared/types/b602-gdl.types'

const mocks = vi.hoisted(() => ({
  executar: vi.fn(),
  transacao: vi.fn(),
  consultarRep: vi.fn(),
  extrairCodigo: vi.fn(),
  converter: vi.fn(),
  buscarRep: vi.fn(),
  atualizarStatusRep: vi.fn(),
  buscarLaudoPorRep: vi.fn(),
  buscarLaudo: vi.fn(),
  atualizarStatusLaudo: vi.fn(),
  sincronizarSecoes: vi.fn(),
  auditar: vi.fn(),
}))

vi.mock('../../main/database/sqlite.js', () => ({
  executeNonQuery: mocks.executar,
  withTransaction: mocks.transacao,
}))

vi.mock('../../main/services/gdl-adaptadores.service.js', () => ({
  converterRepGdl: mocks.converter,
}))

vi.mock('../../main/services/gdl.service.js', () => ({
  consultarRep: mocks.consultarRep,
  extrairCodigoNaturezaExame: mocks.extrairCodigo,
}))

vi.mock('../../main/services/rep.service.js', () => ({
  repService: {
    findById: mocks.buscarRep,
    updateStatus: mocks.atualizarStatusRep,
  },
}))

vi.mock('../../main/services/laudo.service.js', () => ({
  laudoService: {
    findByRepId: mocks.buscarLaudoPorRep,
    findById: mocks.buscarLaudo,
    updateStatus: mocks.atualizarStatusLaudo,
    sincronizarSecoesCondicionais: mocks.sincronizarSecoes,
  },
}))

vi.mock('../../main/services/audit-log.service.js', () => ({
  auditCicloVida: mocks.auditar,
}))

import { atualizacaoRepGdlService } from '../../main/services/atualizacao-rep-gdl.service'

function criarPeca(codigo: number, idLocal: string): PecaB602 {
  return {
    idLocal,
    origem: 'gdl',
    alteradaLocalmente: false,
    codPecaGdl: codigo,
    tipoCodigo: '476',
    tipoPeca: 'Carabina',
    comuns: {
      identificacao: `Identificação ${codigo}`,
      quantidade: 1,
      unidadeMedida: 'UNIDADE',
      quantidadeDescricao: '',
      examinadoInLoco: false,
      materialIncinerado: 'N',
      dataEntrada: '',
      lacreEntrada: '',
      lacreSaida: '',
      dataLiberacao: '',
      codigoVestigio: '',
      consumida: 'N',
      observacao: '',
    },
    personalizados: {},
    extrasGdl: {},
  }
}

function criarRep(camposEspecificos = JSON.stringify({ b602: { pecas: [criarPeca(1, 'local-1')], local: { cidade: 'Cidade local' } } })): REPRow {
  return {
    id: 'rep-1',
    numero: '123/2026',
    solicitante_id: 'solicitante-1',
    tipo_exame_id: 'tipo-1',
    data_requisicao: '2026-01-01',
    status: 'Pendente',
    tipo_solicitacao: 'Local',
    observacoes: 'Observação local',
    campos_especificos: camposEspecificos,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function criarLaudo(status: string): LaudoRow {
  return {
    id: 'laudo-1',
    rep_id: 'rep-1',
    perito_id: 'perito-1',
    template_id: 'template-1',
    conteudo: '<p>Laudo</p>',
    status,
    data_inicio: '2026-01-01T00:00:00.000Z',
    versao: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function criarImportacao(): ResultadoImportacaoExame<DadosImportacaoB602> {
  return {
    codigoExame: 'B-602',
    camposGerais: {
      tipo_solicitacao: 'Ofício',
      observacoes: 'Observação do GDL',
      b602_local_cidade: 'Cidade GDL',
    },
    camposEspecificos: {
      pecas: [criarPeca(1, 'gdl-1'), criarPeca(2, 'gdl-2')],
      dadosSolicitacao: { orgao: '', responsavel: '', autoridade: '', origensDisponiveis: [] },
      dadosInvestigacao: { envolvidos: [], boletinsOcorrencia: [], inqueritosPoliciais: [] },
    },
    avisos: [],
    metadadosIntegracaoGdl: { origemInicial: 'gdl' },
  }
}

describe('AtualizacaoRepGdlService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transacao.mockImplementation(async (operacao: () => Promise<unknown>) => operacao())
    mocks.consultarRep.mockResolvedValue({ sucesso: true, dados: { codRep: 1 }, naturezaExame: 'B-602', ambiente: 'homologacao' })
    mocks.extrairCodigo.mockReturnValue('B-602')
    mocks.converter.mockReturnValue(criarImportacao())
    mocks.buscarRep.mockResolvedValue(criarRep())
    mocks.buscarLaudoPorRep.mockResolvedValue(null)
    mocks.buscarLaudo.mockResolvedValue(null)
    mocks.executar.mockResolvedValue(undefined)
    mocks.atualizarStatusRep.mockResolvedValue(undefined)
    mocks.atualizarStatusLaudo.mockResolvedValue(undefined)
    mocks.sincronizarSecoes.mockResolvedValue(undefined)
  })

  it('aplica somente as diferenças selecionadas e preserva peças locais não selecionadas', async () => {
    const previa = await atualizacaoRepGdlService.preparar('rep-1')

    expect(previa.diferencas.map(diferenca => diferenca.id)).toEqual(expect.arrayContaining([
      'campo:tipo_solicitacao',
      'campo:observacoes',
      'campo:b602_local_cidade',
      'peca:2',
    ]))

    const resultado = await atualizacaoRepGdlService.aplicar({
      operacaoId: previa.operacaoId,
      diferencasSelecionadas: ['campo:observacoes', 'peca:2'],
      reabrirLaudo: false,
    })

    expect(resultado).toEqual({ camposAtualizados: 1, pecasAtualizadas: 1, laudoReconciliado: false, laudoReaberto: false })
    expect(mocks.executar).toHaveBeenCalledTimes(1)
    const parametros = mocks.executar.mock.calls[0][1] as unknown[]
    expect(parametros[0]).toBe('Observação do GDL')
    const camposEspecificos = JSON.parse(String(parametros[1])) as { b602: { local: { cidade: string }, pecas: PecaB602[] } }
    expect(camposEspecificos.b602.local.cidade).toBe('Cidade local')
    expect(camposEspecificos.b602.pecas.map(peca => peca.codPecaGdl)).toEqual([1, 2])
    expect(mocks.atualizarStatusLaudo).not.toHaveBeenCalled()
  })

  it('exige confirmação e reabre o laudo concluído antes de reconciliar seções', async () => {
    const laudo = criarLaudo('Concluído')
    mocks.buscarLaudoPorRep.mockResolvedValue(laudo)
    mocks.buscarLaudo.mockResolvedValue(laudo)
    const previa = await atualizacaoRepGdlService.preparar('rep-1')

    await expect(atualizacaoRepGdlService.aplicar({
      operacaoId: previa.operacaoId,
      diferencasSelecionadas: ['campo:observacoes'],
      reabrirLaudo: false,
    })).rejects.toThrow('Confirme a reabertura do laudo')

    await expect(atualizacaoRepGdlService.aplicar({
      operacaoId: previa.operacaoId,
      diferencasSelecionadas: ['campo:observacoes'],
      reabrirLaudo: true,
    })).resolves.toMatchObject({ laudoReconciliado: true, laudoReaberto: true })

    expect(mocks.atualizarStatusLaudo).toHaveBeenCalledWith('laudo-1', 'Em andamento')
    expect(mocks.atualizarStatusRep).toHaveBeenCalledWith('rep-1', 'Em Andamento')
    expect(mocks.sincronizarSecoes).toHaveBeenCalledWith('laudo-1')
  })

  it('recusa aplicação quando a REP foi alterada após a prévia', async () => {
    const repInicial = criarRep()
    mocks.buscarRep.mockResolvedValueOnce(repInicial).mockResolvedValueOnce({
      ...repInicial,
      updated_at: '2026-01-02T00:00:00.000Z',
    })
    const previa = await atualizacaoRepGdlService.preparar('rep-1')

    await expect(atualizacaoRepGdlService.aplicar({
      operacaoId: previa.operacaoId,
      diferencasSelecionadas: ['campo:observacoes'],
      reabrirLaudo: false,
    })).rejects.toThrow('A REP ou o laudo foi alterado desde a consulta')

    expect(mocks.executar).not.toHaveBeenCalled()
    expect(mocks.sincronizarSecoes).not.toHaveBeenCalled()
  })

  it('recusa aplicação depois que a prévia expira', async () => {
    vi.useFakeTimers()
    try {
      const previa = await atualizacaoRepGdlService.preparar('rep-1')
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1)

      await expect(atualizacaoRepGdlService.aplicar({
        operacaoId: previa.operacaoId,
        diferencasSelecionadas: ['campo:observacoes'],
        reabrirLaudo: false,
      })).rejects.toThrow('A revisão expirou')

      expect(mocks.executar).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
