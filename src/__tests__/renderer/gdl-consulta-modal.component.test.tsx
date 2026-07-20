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
    personalizados: { '476:arma_institucional': '98' },
    extrasGdl: {},
  }
}

const pecaUm = criarPeca(1001, 'CARABINA UM')
const pecaDois = criarPeca(1002, 'CARABINA DOIS')

const resultadoConsulta: ResultadoImportacaoExame<DadosImportacaoB602> = {
  codigoExame: 'B-602',
  camposGerais: {
    numero: '190-2026',
    data_requisicao: '2026-07-19',
    tipo_solicitacao: 'BO',
    numero_documento: '123/2026',
  },
  camposEspecificos: {
    pecas: [pecaUm, pecaDois],
    dadosSolicitacao: {
      orgao: 'UNIDADE POLICIAL',
      responsavel: '',
      autoridade: '',
      origensDisponiveis: [{ tipo: 'BO', numero: '123/2026' }],
    },
    dadosInvestigacao: {
      envolvidos: [],
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
    expect(await screen.findByText('190-2026', { selector: 'strong' })).toBeInTheDocument()
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

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every(checkbox => checkbox.getAttribute('data-state') === 'checked')).toBe(true)

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
})
