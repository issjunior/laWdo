import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GdlPecasModal } from '@/components/rep/GdlPecasModal'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '@shared/types/b602-gdl.types'
import type { PecaI801 } from '@shared/types/i801.types'
import type { DadosImportacaoI801, ResultadoImportacaoI801 } from '@shared/types/gdl-importacao.types'

function criarPeca(): PecaB602 {
  return {
    idLocal: 'peca-gdl-1001', origem: 'gdl', alteradaLocalmente: false, codPecaGdl: 1001,
    tipoCodigo: '476', tipoPeca: 'CARABINA(S)',
    comuns: {
      identificacao: 'CARABINA TESTE', quantidade: 1, unidadeMedida: 'UNIDADE',
      quantidadeDescricao: '', examinadoInLoco: false, materialIncinerado: 'N', dataEntrada: '', lacreEntrada: '', lacreSaida: '',
      dataLiberacao: '', codigoVestigio: '', consumida: 'N', observacao: '',
    },
    personalizados: {}, extrasGdl: {},
  }
}

const resultadoConsulta: ResultadoImportacaoExame<DadosImportacaoB602> = {
  codigoExame: 'B-602',
  camposGerais: { numero: '190-2026' },
  camposEspecificos: {
    pecas: [criarPeca()],
    dadosSolicitacao: { orgao: '', responsavel: '', autoridade: '', origensDisponiveis: [] },
    dadosInvestigacao: { envolvidos: [], boletinsOcorrencia: [], inqueritosPoliciais: [] },
  },
  avisos: [],
}

const pecaI801: PecaI801 = {
  idLocal: 'peca-i801-1001', origem: 'gdl', alteradaLocalmente: false, codPecaGdl: 1001,
  tipoCodigo: 'caminhonete', tipoPeca: 'CAMINHONETE(S)',
  comuns: {
    identificacao: 'ABC-1D23', quantidade: 1, unidadeMedida: 'UNIDADES', quantidadeDescricao: '',
    numeroAnalises: 1, examinadoInLoco: false, dataEntrada: '21/10/2026', lacreEntrada: '', lacreSaida: '',
    dataLiberacao: '', codigoVestigio: '', consumida: 'N', observacao: '',
  },
  personalizados: { placa: 'ABC-1D23' }, extrasGdl: { placaAplicada: 'XYZ-9Z99' },
}

const resultadoConsultaI801: ResultadoImportacaoI801 = {
  codigoExame: 'I-801',
  camposGerais: { numero: '135458-2026' },
  camposEspecificos: {
    pecas: [pecaI801],
    dadosSolicitacao: { orgao: '', responsavel: '', autoridade: '', origensDisponiveis: [] },
    dadosInvestigacao: { envolvidos: [], boletinsOcorrencia: [], inqueritosPoliciais: [] },
  } satisfies DadosImportacaoI801,
  avisos: [],
}

const ipcApiOriginal = window.ipcAPI
const consultarRep = vi.fn()
const obterConfiguracao = vi.fn()

describe('GdlPecasModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consultarRep.mockResolvedValue({ success: true, data: resultadoConsulta })
    obterConfiguracao.mockImplementation(async (chave: string) => ({ success: true, data: chave === 'gdl_ambiente' ? 'homologacao' : 'true' }))
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        gdl: { ...ipcApiOriginal.gdl, consultarRep },
        configuracao: { ...ipcApiOriginal.configuracao, obter: obterConfiguracao },
      },
      writable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true })
  })

  it('consulta automaticamente a REP atual e mantém desmarcada uma peça ainda não importada', async () => {
    const onAplicar = vi.fn()

    render(
      <GdlPecasModal
        open
        onOpenChange={vi.fn()}
        numeroRepCompleto="190-2026"
        pecasAtuais={[]}
        onAplicar={onAplicar}
      />,
    )

    await waitFor(() => expect(consultarRep).toHaveBeenCalledWith('190', '2026'))
    expect(await screen.findByText('CARABINA(S)')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()

    screen.getByRole('checkbox').click()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeChecked())

    screen.getByRole('button', { name: 'Aplicar seleção' }).click()

    expect(onAplicar).toHaveBeenCalledWith(resultadoConsulta, [resultadoConsulta.camposEspecificos.pecas[0]], [resultadoConsulta.camposEspecificos.pecas[0]])
  })

  it('inicia marcada uma peça que permanece importada no formulário', async () => {
    render(
      <GdlPecasModal
        open
        onOpenChange={vi.fn()}
        numeroRepCompleto="190-2026"
        pecasAtuais={[criarPeca()]}
        onAplicar={vi.fn()}
      />,
    )

    expect(await screen.findByText('CARABINA(S)')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByText('Já importada')).toBeInTheDocument()
  })

  it('identifica Produção quando Homologação está desabilitada antes de consultar peças', async () => {
    obterConfiguracao.mockImplementation(async (chave: string) => ({ success: true, data: chave === 'gdl_ambiente' ? 'homologacao' : 'false' }))

    render(
      <GdlPecasModal
        open
        onOpenChange={vi.fn()}
        numeroRepCompleto="109026-2026"
        pecasAtuais={[]}
        onAplicar={vi.fn()}
      />,
    )

    expect(await screen.findByText('Produção')).toBeInTheDocument()
    await waitFor(() => expect(consultarRep).toHaveBeenCalledWith('109026', '2026'))
  })

  it('revisa peças I-801 e mostra os rótulos específicos do catálogo', async () => {
    consultarRep.mockResolvedValue({ success: true, data: resultadoConsultaI801 })

    render(
      <GdlPecasModal
        open
        codigoExame="I-801"
        onOpenChange={vi.fn()}
        numeroRepCompleto="135.458-2026"
        pecasAtuais={[]}
        onAplicar={vi.fn()}
      />,
    )

    expect(await screen.findByText('CAMINHONETE(S)')).toBeInTheDocument()
    expect(screen.getByText('Placa:')).toBeInTheDocument()
    expect(screen.getAllByText('ABC-1D23')).toHaveLength(2)
    expect(screen.getByText('Dados adicionais do GDL que exigem revisão')).toBeInTheDocument()
    expect(screen.getByText('Placa Aplicada')).toBeInTheDocument()
  })
})
