import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaudoRow, REPRow } from '../../main/types/database'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '../../shared/types/b602-gdl.types'
import type { DadosImportacaoB601 } from '../../shared/types/gdl-importacao.types'
import type { PecaBalistica } from '../../shared/types/pecas-balistica.types'

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
  listarTipos: vi.fn(),
  buscarTemplate: vi.fn(),
}))

vi.mock('../../main/services/tipo-exame.service.js', () => ({ tipoExameService: { findAllOrdered: mocks.listarTipos } }))
vi.mock('../../main/services/template.service.js', () => ({ templateService: { findById: mocks.buscarTemplate } }))

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

function criarPecaB601(codigo: number, idLocal: string, extrasGdl: Record<string, unknown> = {}): PecaBalistica {
  return {
    idLocal, origem: 'gdl', alteradaLocalmente: false, codPecaGdl: codigo,
    tipoCodigo: '101', tipoPeca: 'Estojo',
    comuns: {
      identificacao: `Identificação ${codigo}`, quantidade: 1, unidadeMedida: 'UNIDADES',
      quantidadeDescricao: '', examinadoInLoco: false, dataEntrada: '', lacreEntrada: '',
      lacreSaida: '', dataLiberacao: '', codigoVestigio: '', consumida: 'N', observacao: '',
    },
    personalizados: { '101:origem_coleta': '93' }, extrasGdl,
  }
}

function criarImportacaoB601(pecas: PecaBalistica[] = [criarPecaB601(1, 'gdl-1'), criarPecaB601(2, 'gdl-2')]): ResultadoImportacaoExame<DadosImportacaoB601> {
  return {
    codigoExame: 'B-601',
    camposGerais: {
      tipo_solicitacao: 'Ofício', observacoes: 'Observação B601 do GDL', b601_local_cidade: 'Cidade B601',
      b601_numero_bo: 'BO-2', b601_envolvidos_0: 'Nome GDL', b601_envolvidos_qualificacao_0: 'Vítima',
    },
    camposEspecificos: {
      pecas, dadosSolicitacao: { orgao: 'Órgão GDL', responsavel: '', autoridade: '', origensDisponiveis: [] },
      dadosInvestigacao: { envolvidos: [], boletinsOcorrencia: [], inqueritosPoliciais: [] },
    },
    avisos: [], metadadosIntegracaoGdl: { origemInicial: 'gdl' },
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
    mocks.listarTipos.mockResolvedValue([{ id: 'tipo-gdl', codigo: 'B-602', ativo: true }])
    mocks.buscarTemplate.mockResolvedValue(null)
  })

  it('reutiliza a consulta detalhada e exige seleção explícita para tipo e vazio confirmado', async () => {
    const consulta = await mocks.consultarRep();
    mocks.consultarRep.mockClear();
    const previa = await atualizacaoRepGdlService.preparar('rep-1', consulta, ['observacoes']);
    expect(mocks.consultarRep).not.toHaveBeenCalled();
    expect(previa.diferencas.find(item => item.id === 'campo:tipo_exame_id')?.selecionadaPorPadrao).toBe(false);
    expect(previa.diferencas.find(item => item.id === 'campo:observacoes')).toMatchObject({ valorGdl: 'Vazio confirmado no GDL', selecionadaPorPadrao: false });
    await atualizacaoRepGdlService.aplicar({ operacaoId: previa.operacaoId, diferencasSelecionadas: ['campo:observacoes'], reabrirLaudo: false });
    expect(mocks.executar.mock.calls[0][0]).not.toContain('tipo_exame_id =');
    expect(mocks.executar.mock.calls[0][1][0]).toBe('');
  })

  it('aplica somente as diferenças selecionadas e preserva peças locais não selecionadas', async () => {
    const previa = await atualizacaoRepGdlService.preparar('rep-1')

    expect(previa.diferencas.map(diferenca => diferenca.id)).toEqual(expect.arrayContaining([
      'campo:tipo_solicitacao',
      'campo:observacoes',
      'campo:b602_local_cidade',
      'peca:2',
    ]))
    expect(previa.diferencas.map(diferenca => diferenca.id)).not.toContain('peca:1')

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

  it('apresenta os campos alterados da peça sem expor o código interno do GDL', async () => {
    const pecaLocal = criarPeca(1, 'local-1')
    const pecaAtualizada = {
      ...criarPeca(1, 'gdl-1'),
      comuns: { ...criarPeca(1, 'gdl-1').comuns, lacreSaida: 'LS-002' },
    }
    mocks.buscarRep.mockResolvedValue(criarRep(JSON.stringify({ b602: { pecas: [pecaLocal], local: { cidade: 'Cidade local' } } })))
    mocks.converter.mockReturnValue({
      ...criarImportacao(),
      camposEspecificos: {
        ...criarImportacao().camposEspecificos,
        pecas: [pecaAtualizada],
      },
    })

    const previa = await atualizacaoRepGdlService.preparar('rep-1')
    const diferenca = previa.diferencas.find(item => item.id === 'peca:1')

    expect(diferenca).toMatchObject({
      rotulo: 'Peça Carabina',
      resumo: 'Identificação: Identificação 1',
      detalhes: [{ campo: 'Lacre de saída', valorLocal: 'Não preenchido', valorGdl: 'LS-002' }],
    })
    expect(diferenca?.rotulo).not.toContain('(1)')
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
    expect(mocks.sincronizarSecoes).toHaveBeenCalledWith(
      'laudo-1',
      expect.objectContaining({ b602: expect.any(Object) }),
    )
  })

  it('reconcilia o laudo sem alterar a REP quando o GDL não possui diferenças', async () => {
    const laudo = criarLaudo('Em andamento')
    mocks.buscarLaudoPorRep.mockResolvedValue(laudo)
    mocks.buscarLaudo.mockResolvedValue(laudo)
    mocks.converter.mockReturnValue({
      ...criarImportacao(),
      camposGerais: {
        tipo_solicitacao: 'Local',
        observacoes: 'Observação local',
        b602_local_cidade: 'Cidade local',
      },
      camposEspecificos: {
        ...criarImportacao().camposEspecificos,
        pecas: [criarPeca(1, 'gdl-1')],
      },
    })

    const previa = await atualizacaoRepGdlService.preparar('rep-1')
    expect(previa.diferencas).toHaveLength(0)

    await expect(atualizacaoRepGdlService.aplicar({
      operacaoId: previa.operacaoId,
      diferencasSelecionadas: [],
      reabrirLaudo: false,
    })).resolves.toEqual({
      camposAtualizados: 0,
      pecasAtualizadas: 0,
      laudoReconciliado: true,
      laudoReaberto: false,
    })

    expect(mocks.executar).not.toHaveBeenCalled()
    expect(mocks.sincronizarSecoes).toHaveBeenCalledWith('laudo-1', expect.any(Object))
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

  it('prepara atualização seletiva B601 com campos, envolvidos e peças', async () => {
    const pecaLocal = criarPecaB601(1, 'local-1')
    mocks.extrairCodigo.mockReturnValue('B-601')
    mocks.converter.mockReturnValue(criarImportacaoB601())
    mocks.buscarRep.mockResolvedValue(criarRep(JSON.stringify({
      b601: { pecas: [pecaLocal], local: { cidade: 'Cidade local' }, envolvidos: ['Antigo'] },
    })))
    const previa = await atualizacaoRepGdlService.preparar('rep-1')

    expect(previa.codigoExame).toBe('B-601')
    expect(previa.diferencas).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'campo:b601_local_cidade', grupo: 'Dados B-601' }),
      expect.objectContaining({ id: 'campo:b601_envolvidos_0', grupo: 'Dados B-601' }),
      expect.objectContaining({ id: 'peca:2', grupo: 'Peças B-601' }),
    ]))
    expect(previa.diferencas.map(item => item.id)).not.toContain('peca:1')
  })

  it('aplica somente diferenças B601 selecionadas e preserva peças locais', async () => {
    mocks.extrairCodigo.mockReturnValue('B-601')
    mocks.converter.mockReturnValue(criarImportacaoB601())
    mocks.buscarRep.mockResolvedValue(criarRep(JSON.stringify({
      b601: { pecas: [criarPecaB601(1, 'local-1')], local: { cidade: 'Cidade local' }, envolvidos: ['Antigo'] },
    })))
    const previa = await atualizacaoRepGdlService.preparar('rep-1')
    await atualizacaoRepGdlService.aplicar({
      operacaoId: previa.operacaoId,
      diferencasSelecionadas: ['campo:b601_local_cidade', 'peca:2'],
      reabrirLaudo: false,
    })

    const campos = JSON.parse(String((mocks.executar.mock.calls[0][1] as unknown[])[0])) as { b601: { local: { cidade: string }; pecas: PecaBalistica[] } }
    expect(campos.b601.local.cidade).toBe('Cidade B601')
    expect(campos.b601.pecas.map(peca => peca.codPecaGdl)).toEqual([1, 2])
    expect(campos.b601.pecas[0].idLocal).toBe('local-1')
  })

  it('preserva extras GDL e não marca ausência de peças automaticamente no B601', async () => {
    mocks.extrairCodigo.mockReturnValue('B-601')
    mocks.converter.mockReturnValue(criarImportacaoB601([criarPecaB601(1, 'gdl-1', { 'Campo novo': 'valor' })]))
    mocks.buscarRep.mockResolvedValue(criarRep(JSON.stringify({ b601: { semPecas: false, pecas: [], local: {}, envolvidos: [] } })))
    const previa = await atualizacaoRepGdlService.preparar('rep-1')
    expect(previa.diferencas.find(item => item.id === 'peca:1')?.detalhes).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'Dado adicional: Campo novo', valorGdl: 'valor' }),
    ]))

    mocks.converter.mockReturnValue(criarImportacaoB601([]))
    const semPecas = await atualizacaoRepGdlService.preparar('rep-1')
    expect(semPecas.diferencas.some(item => item.id.startsWith('peca:'))).toBe(false)
  })
})
