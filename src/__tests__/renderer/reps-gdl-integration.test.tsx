import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { REPsPage } from '@/pages/REPsPage'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '@shared/types/b602-gdl.types'

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
  camposGerais: {
    numero: '190-2026',
    data_requisicao: '2026-07-19',
    tipo_solicitacao: 'BO',
    numero_documento: '123/2026',
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
  avisos: [],
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

    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '190' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('190-2026', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Preencher formulário' }))

    await waitFor(() => expect(screen.getByDisplayValue('190-2026')).toBeInTheDocument())
    expect(await screen.findByText('CARABINA(S)')).toBeInTheDocument()
    expect(screen.getByText('Importada do GDL')).toBeInTheDocument()
    expect(screen.getByText(/CARABINA INTEGRADA/)).toBeInTheDocument()
    expect(consultarRep).toHaveBeenCalledWith('190', '2026')
    expect(criarRep).not.toHaveBeenCalled()
  })
})
