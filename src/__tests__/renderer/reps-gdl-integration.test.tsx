import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { REPsPage } from '@/pages/REPsPage'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '@shared/types/b602-gdl.types'

const { toastInfo } = vi.hoisted(() => ({ toastInfo: vi.fn() }))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: toastInfo, success: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/components/data-table/data-table', () => ({
  DataTable: () => <div data-testid="tabela-reps" />,
}))

vi.mock('@/components/rep/RepStepper', () => ({
  RepStepper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRepStepperContext: () => '',
}))

function criarPeca(): PecaB602 {
  return {
    idLocal: 'peca-gdl-1001',
    origem: 'gdl',
    alteradaLocalmente: false,
    codPecaGdl: 1001,
    tipoCodigo: '476',
    tipoPeca: 'CARABINA(S)',
    comuns: {
      identificacao: 'CARABINA INTEGRADA',
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

const resultadoConsulta: ResultadoImportacaoExame<DadosImportacaoB602> = {
  codigoExame: 'B-602',
  naturezaExameGdl: 'B602 - EXAME BALÍSTICO',
  camposGerais: {
    numero: '109026-2026',
    data_requisicao: '2026-07-19',
    tipo_solicitacao: 'BO',
    numero_documento: '3216-2026/JO',
    observacoes: 'Quesito aberto importado do GDL',
    b602_numero_bo: '123/2026',
    b602_envolvidos_0: 'PESSOA TESTE',
    b602_local_cidade: 'CURITIBA',
    b602_local_uf: 'PR',
  },
  camposEspecificos: {
    pecas: [criarPeca()],
    dadosSolicitacao: {
      orgao: 'UNIDADE POLICIAL',
      responsavel: '',
      autoridade: '',
      origensDisponiveis: [{ tipo: 'BO', numero: '123/2026' }],
    },
    dadosInvestigacao: {
      envolvidos: ['PESSOA TESTE'],
      boletinsOcorrencia: [{ tipo: 'BO', numero: '123/2026' }],
      inqueritosPoliciais: [],
    },
  },
  avisos: [{
    codigo: 'FUNCIONAMENTO_NAO_TESTADO_PADRAO',
    mensagem: 'O campo Funcionamento foi definido automaticamente como "NÃO TESTADO" para as peças importadas nas quais essa informação não foi retornada pelo GDL.',
    contexto: { quantidadePecas: 1 },
  }],
}

const ipcApiOriginal = window.ipcAPI
const criarRep = vi.fn()
const consultarRep = vi.fn()

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.scrollIntoView = () => undefined
})

describe('integração da consulta geral GDL com REPsPage', () => {
  beforeEach(() => {
    criarRep.mockResolvedValue({ success: true, data: { id: 'rep-criada' } })
    consultarRep.mockResolvedValue({ success: true, data: resultadoConsulta })
    toastInfo.mockReset()

    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        rep: {
          findAll: vi.fn().mockResolvedValue({ success: true, data: [] }),
          create: criarRep,
        },
        laudo: {
          findAll: vi.fn().mockResolvedValue({ success: true, data: [] }),
        },
        solicitante: {
          findAll: vi.fn().mockResolvedValue({ success: true, data: [] }),
        },
        tipoExame: {
          findAll: vi.fn().mockResolvedValue({
            success: true,
            data: [{ id: 'tipo-b602', codigo: 'B-602', nome: 'Balística' }],
          }),
        },
        template: {
          findByTipoExame: vi.fn().mockResolvedValue({ success: true, data: [] }),
        },
        configuracao: {
          obter: vi.fn().mockResolvedValue({ success: true, data: 'homologacao' }),
        },
        gdl: {
          testarConexao: vi.fn().mockResolvedValue({
            success: true,
            data: {
              sucesso: true,
              latencia: 20,
              ambiente: 'homologacao',
              statusCode: 200,
              autenticado: true,
            },
          }),
          consultarRep,
        },
      },
      writable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true })
  })

  it('preenche o mesmo formulário, importa as peças e não salva automaticamente', async () => {
    render(
      <MemoryRouter>
        <REPsPage />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Nova REP' }))
    fireEvent.click(screen.getByRole('button', { name: 'GDL' }))

    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '109026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findAllByText('109026-2026', { selector: 'span' })).not.toHaveLength(0)
    expect(screen.getByText('3216-2026/JO')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Preencher formulário' }))

    await waitFor(() => expect(screen.getByDisplayValue('109.026-2026')).toBeInTheDocument())
    expect(screen.getByDisplayValue('3216-2026/JO')).toBeInTheDocument()
    expect(screen.getByLabelText('Quesito Aberto')).toHaveValue('Quesito aberto importado do GDL')
    expect(screen.getByRole('combobox', { name: /tipo de exame/i })).toHaveTextContent('B-602 - Balística')
    expect(await screen.findByText('CARABINA(S)')).toBeInTheDocument()
    expect(screen.getByText('Importada do GDL')).toBeInTheDocument()
    expect(screen.getByText(/CARABINA INTEGRADA/)).toBeInTheDocument()
    expect(toastInfo).toHaveBeenCalledWith(
      'O campo Funcionamento foi definido automaticamente como "NÃO TESTADO" para as peças importadas nas quais essa informação não foi retornada pelo GDL.',
      { duration: 12000 },
    )
    expect(consultarRep).toHaveBeenCalledWith('109026', '2026')
    expect(criarRep).not.toHaveBeenCalled()
  })

  it('preserva o quesito local ao mesclar uma consulta GDL', async () => {
    render(<MemoryRouter><REPsPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Nova REP' }))
    fireEvent.change(screen.getByLabelText('Quesito Aberto'), { target: { value: 'Quesito editado localmente.' } })
    fireEvent.click(screen.getByRole('button', { name: 'GDL' }))
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '109026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar ao Formulário' }))

    expect(screen.getByLabelText('Quesito Aberto')).toHaveValue('Quesito editado localmente.')
  })

  it('substitui o quesito local quando o usuário escolhe substituir', async () => {
    render(<MemoryRouter><REPsPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Nova REP' }))
    fireEvent.change(screen.getByLabelText('Quesito Aberto'), { target: { value: 'Quesito editado localmente.' } })
    fireEvent.click(screen.getByRole('button', { name: 'GDL' }))
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '109026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.click((await screen.findAllByRole('radio'))[1])
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar ao Formulário' }))

    expect(screen.getByLabelText('Quesito Aberto')).toHaveValue('Quesito aberto importado do GDL')
  })
})
