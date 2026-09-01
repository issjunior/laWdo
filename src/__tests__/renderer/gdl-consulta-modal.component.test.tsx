import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GdlConsultaModal } from '@/components/rep/GdlConsultaModal'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '@shared/types/b602-gdl.types'

function criarPeca(codigo: number, identificacao: string): PecaB602 {
  return {
    idLocal: `peca-gdl-${codigo}`,
    origem: 'gdl',
    alteradaLocalmente: false,
    codPecaGdl: codigo,
    tipoCodigo: '476',
    tipoPeca: 'CARABINA(S)',
    comuns: {
      identificacao,
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
    personalizados: { '476:arma_institucional': '98', '476:funcionamento': '57' },
    extrasGdl: {},
  }
}

const pecaUm = criarPeca(1001, 'CARABINA UM')
const pecaDois = criarPeca(1002, 'CARABINA DOIS')

const resultadoConsulta: ResultadoImportacaoExame<DadosImportacaoB602> = {
  codigoExame: 'B-602',
  naturezaExameGdl: 'B602 - EXAME BALÍSTICO',
  camposGerais: {
    numero: '190-2026',
    data_requisicao: '2026-07-19',
    tipo_solicitacao: 'BO',
    numero_documento: '123/2026',
    data_documento: '2026-07-18',
    observacoes: 'QUESITO DE TESTE',
    b602_local_cidade: 'CURITIBA',
    b602_solicitante_nome: 'UNIDADE POLICIAL',
    b602_envolvidos_qualificacao_0: 'VÍTIMA:',
    b602_envolvidos_0: 'PESSOA TESTE',
  },
  camposEspecificos: {
    pecas: [pecaUm, pecaDois],
    dadosSolicitacao: {
      orgao: 'UNIDADE POLICIAL',
      responsavel: '',
      autoridade: '',
      origensDisponiveis: [{ tipo: 'BO', numero: '123/2026', dataDocumento: '2026-07-18' }],
    },
    dadosInvestigacao: {
      envolvidos: ['VÍTIMA: PESSOA TESTE'],
      boletinsOcorrencia: [{ tipo: 'BO', numero: '123/2026' }],
      inqueritosPoliciais: [],
    },
  },
  avisos: [],
}

const ipcApiOriginal = window.ipcAPI
const obterConfiguracao = vi.fn()
const testarConexao = vi.fn()
const consultarRep = vi.fn()

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.scrollIntoView = () => undefined
})

describe('GdlConsultaModal', () => {
  beforeEach(() => {
    obterConfiguracao.mockResolvedValue({ success: true, data: 'homologacao' })
    testarConexao.mockResolvedValue({
      success: true,
      data: {
        sucesso: true,
        latencia: 25,
        ambiente: 'homologacao',
        statusCode: 200,
        autenticado: true,
      },
    })
    consultarRep.mockResolvedValue({ success: true, data: resultadoConsulta })

    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        configuracao: { obter: obterConfiguracao },
        gdl: { testarConexao, consultarRep },
      },
      writable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true })
  })

  async function buscarRep() {
    fireEvent.change(screen.getByLabelText('Nº da REP'), { target: { value: '190' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findAllByText('190-2026')).not.toHaveLength(0)
  }

  it('inicia com todas as peças marcadas e aplica a consulta em modo mesclar', async () => {
    const onAplicar = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <GdlConsultaModal
        open
        onOpenChange={onOpenChange}
        onAplicar={onAplicar}
        temDadosExistentes={false}
        pecasB602={[]}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('homologacao'))
    await buscarRep()

    expect(screen.queryByText('Busque uma REP no GDL para preencher automaticamente o formulário.')).not.toBeInTheDocument()
    expect(screen.queryByText('Peças estruturadas:')).not.toBeInTheDocument()
    expect(screen.queryByText(/campos serão preenchidos/)).not.toBeInTheDocument()
    expect(screen.queryByText('10 permanecem vazios.')).not.toBeInTheDocument()
    expect(screen.getByText('REP: 190-2026')).toHaveClass('font-bold', 'text-primary')
    expect(screen.getByText('B602 - EXAME BALÍSTICO')).toBeInTheDocument()
    expect(screen.queryByText('Revisão das peças do GDL')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desmarcar todas' })).toBeInTheDocument()
    expect(screen.queryByText('ID', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('19/07/2026')).toBeInTheDocument()
    expect(screen.getByText('Identificação da REP')).toBeInTheDocument()
    expect(screen.getByText('Solicitação')).toBeInTheDocument()
    expect(screen.getByText('Data do Documento')).toBeInTheDocument()
    expect(screen.getByText('18/07/2026')).toBeInTheDocument()
    expect(screen.queryByText('Solicitante e Local')).not.toBeInTheDocument()
    expect(screen.getByText('Envolvidos (1)')).toBeInTheDocument()
    expect(screen.getByText('PESSOA TESTE')).toBeInTheDocument()
    expect(screen.getByText('Quesito Aberto')).toBeInTheDocument()
    expect(screen.getByText('QUESITO DE TESTE')).toBeInTheDocument()
    expect(screen.getByText('Peças Encontradas (2)')).toBeInTheDocument()
    expect(screen.queryByText('Tipo de Exame')).not.toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every(checkbox => checkbox.getAttribute('data-state') === 'checked')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todas' }))
    expect(checkboxes.every(checkbox => checkbox.getAttribute('data-state') === 'unchecked')).toBe(true)
    expect(screen.getByRole('button', { name: 'Selecionar todas' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas' }))

    fireEvent.click(screen.getByRole('button', { name: 'Preencher formulário' }))

    await waitFor(() => expect(onAplicar).toHaveBeenCalledOnce())
    expect(onAplicar).toHaveBeenCalledWith(resultadoConsulta, 'mesclar', [pecaUm, pecaDois])
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('envia somente as peças selecionadas ao aplicar em modo substituir', async () => {
    const onAplicar = vi.fn()
    const pecaAusente = criarPeca(1003, 'CARABINA AUSENTE')
    render(
      <GdlConsultaModal
        open
        onOpenChange={vi.fn()}
        onAplicar={onAplicar}
        temDadosExistentes
        pecasB602={[pecaUm, pecaAusente]}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('homologacao'))
    await buscarRep()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).toBeChecked()
    expect(checkboxes[2]).not.toBeChecked()

    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByRole('radio', { name: 'Substituir dados do GDL' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar ao Formulário' }))

    await waitFor(() => expect(onAplicar).toHaveBeenCalledOnce())
    expect(onAplicar).toHaveBeenCalledWith(
      {
        ...resultadoConsulta,
        camposEspecificos: {
          ...resultadoConsulta.camposEspecificos,
          pecas: [pecaUm],
        },
      },
      'substituir',
      [pecaUm],
    )
  })

  it('exige uma origem no fallback e aplica tipo, número e data da escolha', async () => {
    const onAplicar = vi.fn()
    const resultadoSemFamiliaPreferencial: ResultadoImportacaoExame<DadosImportacaoB602> = {
      ...resultadoConsulta,
      camposGerais: {
        ...resultadoConsulta.camposGerais,
        tipo_solicitacao: '',
        numero_documento: '',
        data_documento: '',
      },
      camposEspecificos: {
        ...resultadoConsulta.camposEspecificos,
        dadosSolicitacao: {
          ...resultadoConsulta.camposEspecificos.dadosSolicitacao,
          origensDisponiveis: [
            { tipo: 'PROCESSO', numero: '1/2026', dataDocumento: '2026-07-01' },
            { tipo: 'REQUISIÇÃO', numero: '2/2026', dataDocumento: '2026-07-02' },
          ],
        },
      },
    }
    consultarRep.mockResolvedValueOnce({ success: true, data: resultadoSemFamiliaPreferencial })
    render(
      <GdlConsultaModal
        open
        onOpenChange={vi.fn()}
        onAplicar={onAplicar}
        temDadosExistentes={false}
        pecasB602={[]}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('homologacao'))
    await buscarRep()

    const preencher = screen.getByRole('button', { name: 'Preencher formulário' })
    expect(preencher).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Origem utilizada no formulário'))
    fireEvent.click(await screen.findByRole('option', { name: 'REQUISIÇÃO — 2/2026 — 02/07/2026' }))
    expect(preencher).toBeEnabled()
    fireEvent.click(preencher)

    await waitFor(() => expect(onAplicar).toHaveBeenCalledOnce())
    expect(onAplicar).toHaveBeenCalledWith(expect.objectContaining({
      camposGerais: expect.objectContaining({
        tipo_solicitacao: 'REQUISIÇÃO',
        numero_documento: '2/2026',
        data_documento: '2026-07-02',
      }),
    }), 'mesclar', [pecaUm, pecaDois])
  })

  it('fecha sem consultar ou aplicar quando o usuário cancela', async () => {
    const onAplicar = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <GdlConsultaModal
        open
        onOpenChange={onOpenChange}
        onAplicar={onAplicar}
        temDadosExistentes={false}
        pecasB602={[]}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(consultarRep).not.toHaveBeenCalled()
    expect(onAplicar).not.toHaveBeenCalled()
  })

  it('orienta o usuário quando o endereço do GDL não pode ser localizado', async () => {
    testarConexao.mockResolvedValue({
      success: true,
      data: {
        sucesso: false,
        latencia: 0,
        ambiente: 'Produção',
        statusCode: 0,
        autenticado: false,
        erro: 'net::ERR_NAME_NOT_RESOLVED',
      },
    })
    render(
      <GdlConsultaModal
        open
        onOpenChange={vi.fn()}
        onAplicar={vi.fn()}
        temDadosExistentes={false}
        pecasB602={[]}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    expect(await screen.findByText('Não foi possível localizar o endereço do GDL. Verifique a conexão com a VPN institucional e tente novamente.')).toBeInTheDocument()
    expect(screen.queryByText('net::ERR_NAME_NOT_RESOLVED')).not.toBeInTheDocument()
  })

  it('identifica o ambiente de Produção antes da consulta', async () => {
    obterConfiguracao.mockResolvedValue({ success: true, data: 'producao' })
    testarConexao.mockResolvedValue({
      success: true,
      data: { sucesso: true, latencia: 25, ambiente: 'producao', statusCode: 200, autenticado: true },
    })
    render(
      <GdlConsultaModal
        open
        onOpenChange={vi.fn()}
        onAplicar={vi.fn()}
        temDadosExistentes={false}
        pecasB602={[]}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    expect(await screen.findByText('Produção')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nº da REP'), { target: { value: '109026' } })
    expect(screen.getByLabelText('Nº da REP')).toHaveValue('109.026')
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled()
  })

  it('oferece o e-mail de suporte quando a natureza ainda não possui formulário', async () => {
    consultarRep.mockResolvedValueOnce({
      success: false,
      error: 'O formulário para a natureza de exame B-612 - EXAME DE CONFRONTO BALÍSTICO ainda está em desenvolvimento no laWdo. Os dados não foram importados.',
    })
    render(
      <GdlConsultaModal
        open
        onOpenChange={vi.fn()}
        onAplicar={vi.fn()}
        temDadosExistentes={false}
        pecasB602={[]}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('homologacao'))
    fireEvent.change(screen.getByLabelText('Nº da REP'), { target: { value: '190' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('B-612 - EXAME DE CONFRONTO BALÍSTICO')).toHaveClass('font-semibold')
    expect(screen.getByRole('button', { name: 'Dúvidas/Sugestões' })).toBeInTheDocument()
  })

  it('reserva o aviso de Funcionamento para a confirmação após preencher o formulário', async () => {
    consultarRep.mockResolvedValueOnce({
      success: true,
      data: {
        ...resultadoConsulta,
        avisos: [{
          codigo: 'FUNCIONAMENTO_NAO_TESTADO_PADRAO',
          mensagem: 'O campo Funcionamento foi definido automaticamente como "NÃO TESTADO" para as peças importadas nas quais essa informação não foi retornada pelo GDL.',
          contexto: { quantidadePecas: 1 },
        }],
      },
    })
    render(
      <GdlConsultaModal
        open
        onOpenChange={vi.fn()}
        onAplicar={vi.fn()}
        temDadosExistentes={false}
        pecasB602={[]}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('homologacao'))
    await buscarRep()

    expect(screen.queryByText('O campo Funcionamento foi definido automaticamente como "NÃO TESTADO" para as peças importadas nas quais essa informação não foi retornada pelo GDL.')).not.toBeInTheDocument()
  })
})
