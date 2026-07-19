import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GdlPecasModal } from '@/components/rep/GdlPecasModal'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '@shared/types/b602-gdl.types'

function criarPeca(): PecaB602 {
  return {
    idLocal: 'peca-gdl-1001', origem: 'gdl', alteradaLocalmente: false, codPecaGdl: 1001,
    tipoCodigo: '476', tipoPeca: 'CARABINA(S)',
    comuns: {
      identificacao: 'CARABINA TESTE', numeroAnalises: '', quantidade: 1, unidadeMedida: 'UNIDADE',
      quantidadeDescricao: '', examinadoInLoco: false, dataEntrada: '', lacreEntrada: '', lacreSaida: '',
      dataLiberacao: '', codigoVestigio: '', consumida: '', observacao: '',
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

const ipcApiOriginal = window.ipcAPI
const consultarRep = vi.fn()

describe('GdlPecasModal', () => {
  beforeEach(() => {
    consultarRep.mockResolvedValue({ success: true, data: resultadoConsulta })
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        gdl: { ...ipcApiOriginal.gdl, consultarRep },
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
})
