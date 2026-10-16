import { identificarNaturezaExame } from '@shared/gdl/natureza-exame'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
const identificarRep = vi.fn()
const completarConsultaRep = vi.fn()
const copiarEmailSuporte = vi.fn()

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.scrollIntoView = () => undefined
})

describe('GdlConsultaModal', () => {
  beforeEach(() => {
    obterConfiguracao.mockImplementation(async (chave: string) => ({ success: true, data: chave === 'gdl_ambiente' ? 'homologacao' : 'true' }))
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
    identificarRep.mockResolvedValue({ success: true, data: {
      consultaId: '11111111-1111-4111-8111-111111111111',
      identificacao: identificarNaturezaExame('B602 - EXAME BALÍSTICO'),
      tiposLocais: [{ id: 'tipo-b602', codigo: 'B-602', nome: 'Balística' }],
      codigosImportacaoDisponiveis: ['B-601', 'B-602'],
      avisos: [],
    } })
    consultarRep.mockResolvedValue({ success: true, data: resultadoConsulta })
    copiarEmailSuporte.mockResolvedValue({ success: true, data: { email: 'izaias.junior@policiacientifica.pr.gov.br' } })

    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        configuracao: { obter: obterConfiguracao },
        gdl: { testarConexao, consultarRep, identificarRep, completarConsultaRep, copiarEmailSuporte, converterConsultaRep: consultarRep },
      },
      writable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true })
  })

  async function buscarRep() {
    fireEvent.change(screen.getByLabelText('Nº da REP'), { target: { value: '190' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled())
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
        onDefinirTipo={vi.fn()}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('homologacao'))
    await buscarRep()

    expect(screen.queryByText('Busque uma REP no GDL para preencher automaticamente o formulário.')).not.toBeInTheDocument()
    expect(screen.queryByText('Peças estruturadas:')).not.toBeInTheDocument()
    expect(screen.queryByText(/campos serão preenchidos/)).not.toBeInTheDocument()
    expect(screen.queryByText('10 permanecem vazios.')).not.toBeInTheDocument()
    expect(screen.getByText('190-2026')).toBeInTheDocument()
    expect(screen.getByText('B602 - EXAME BALÍSTICO')).toBeInTheDocument()
    expect(screen.queryByText('Revisão das peças do GDL')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desmarcar todas' })).toBeInTheDocument()
    expect(screen.queryByText('ID', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('19/07/2026')).toBeInTheDocument()
    expect(screen.getByText('Identificação da REP')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Solicitação' })).toBeInTheDocument()
    expect(screen.getByText('Data do Documento')).toBeInTheDocument()
    expect(screen.getByText('18/07/2026')).toBeInTheDocument()
    expect(screen.queryByText('Solicitante e Local')).not.toBeInTheDocument()
    expect(screen.getByText('Envolvidos (1)')).toBeInTheDocument()
    expect(screen.getByText('PESSOA TESTE')).toBeInTheDocument()
    expect(screen.getByText('Quesito Aberto')).toBeInTheDocument()
    expect(screen.getByText('QUESITO DE TESTE')).toBeInTheDocument()
    expect(screen.getByText('Peças Encontradas (2)')).toBeInTheDocument()
    expect(screen.queryByText('Tipo de Exame')).not.toBeInTheDocument()

    const [checkboxEnvolvido, ...checkboxesPecas] = screen.getAllByRole('checkbox')
    expect(checkboxEnvolvido).toBeChecked()
    expect(checkboxesPecas).toHaveLength(2)
    expect(checkboxesPecas.every(checkbox => checkbox.getAttribute('data-state') === 'checked')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todas' }))
    expect(checkboxEnvolvido).toBeChecked()
    expect(checkboxesPecas.every(checkbox => checkbox.getAttribute('data-state') === 'unchecked')).toBe(true)
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
        onDefinirTipo={vi.fn()}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('homologacao'))
    await buscarRep()

    const [checkboxEnvolvido, checkboxPecaUm, checkboxPecaDois, checkboxPecaAusente] = screen.getAllByRole('checkbox')
    expect(checkboxEnvolvido).toBeChecked()
    expect(checkboxPecaUm).toBeChecked()
    expect(checkboxPecaDois).toBeChecked()
    expect(checkboxPecaAusente).not.toBeChecked()

    fireEvent.click(checkboxPecaDois)
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
        onDefinirTipo={vi.fn()}
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
        onDefinirTipo={vi.fn()}
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
        onDefinirTipo={vi.fn()}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    expect(await screen.findByText('Não foi possível localizar o endereço do GDL. Verifique a conexão com a VPN institucional e tente novamente.')).toBeInTheDocument()
    expect(screen.queryByText('net::ERR_NAME_NOT_RESOLVED')).not.toBeInTheDocument()
  })

  it('identifica Produção quando a configuração antiga aponta para Homologação desabilitada', async () => {
    obterConfiguracao.mockImplementation(async (chave: string) => ({ success: true, data: chave === 'gdl_ambiente' ? 'homologacao' : 'false' }))
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
        onDefinirTipo={vi.fn()}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    expect(await screen.findByText('Produção')).toBeInTheDocument()
    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('producao'))
    fireEvent.change(screen.getByLabelText('Nº da REP'), { target: { value: '109026' } })
    expect(screen.getByLabelText('Nº da REP')).toHaveValue('109.026')
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled()
  })

  it('permite usar o tipo local sem importar quando não há adaptador', async () => {
    identificarRep.mockResolvedValueOnce({ success: true, data: {
      consultaId: '11111111-1111-4111-8111-111111111111',
      identificacao: identificarNaturezaExame('B612 - EXAME DE CONFRONTO BALÍSTICO'),
      tiposLocais: [{ id: 'tipo-b612', codigo: 'B-612', nome: 'Confronto' }], avisos: [],
    } })
    consultarRep.mockResolvedValueOnce({ success: false, error: 'O exame B-612 não possui adaptador de importação GDL.' })
    const definirTipo = vi.fn()
    const aplicar = vi.fn()
    render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={aplicar} temDadosExistentes={false}
      pecasB602={[]} onDefinirTipo={definirTipo} onConfigurarCredenciais={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '190' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar tipo e revisar dados' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Usar tipo e preencher localmente' }))
    expect(definirTipo).toHaveBeenCalledWith('tipo-b612', '190', '2026')
    expect(aplicar).not.toHaveBeenCalled()
    expect(identificarRep).toHaveBeenCalledTimes(1)
  })

  it('sugere B601 e permite trocar para I806 sem repetir a consulta', async () => {
    identificarRep.mockResolvedValueOnce({ success: true, data: {
      consultaId: '11111111-1111-4111-8111-111111111111',
      identificacao: identificarNaturezaExame('EXAME DE CONSTATAÇÃO'),
      tiposLocais: [
        { id: 'tipo-b601', codigo: 'B-601', nome: 'Constatação balística' },
        { id: 'tipo-i806', codigo: 'I806', nome: 'Constatação veicular' },
      ], avisos: [],
    } });
    consultarRep.mockResolvedValueOnce({ success: false, error: 'O exame I-806 não possui adaptador de importação GDL.' });
    render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={vi.fn()} temDadosExistentes={false}
      pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '190' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    const tipo = await screen.findByLabelText('Tipo de exame local');
    expect(tipo).toHaveTextContent('B-601 - Constatação balística');
    fireEvent.click(tipo);
    fireEvent.click(await screen.findByRole('option', { name: 'I806 - Constatação veicular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar tipo e revisar dados' }));
    await waitFor(() => expect(consultarRep).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'tipo-i806'));
    expect(identificarRep).toHaveBeenCalledTimes(1);
  });

  it('preserva a escolha local existente quando a API só fornece uma descrição ambígua', async () => {
    identificarRep.mockResolvedValueOnce({ success: true, data: {
      consultaId: '11111111-1111-4111-8111-111111111111',
      identificacao: identificarNaturezaExame('EXAME DE CONSTATAÇÃO'),
      tiposLocais: [{ id: 'tipo-b601', codigo: 'B601', nome: 'Balística' }, { id: 'tipo-i806', codigo: 'I806', nome: 'Veicular' }], avisos: [],
    } });
    render(<GdlConsultaModal open tipoExameAtualId="tipo-i806" onOpenChange={vi.fn()} onAplicar={vi.fn()}
      temDadosExistentes pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '190' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByLabelText('Tipo de exame local')).toHaveTextContent('I806 - Veicular');
    expect(consultarRep).not.toHaveBeenCalled();
  });

  it('não habilita a conversão quando o código explícito não está cadastrado localmente', async () => {
    identificarRep.mockResolvedValueOnce({ success: true, data: {
      consultaId: '11111111-1111-4111-8111-111111111111',
      identificacao: identificarNaturezaExame('I806 - EXAME DE CONSTATAÇÃO'),
      tiposLocais: [{ id: 'tipo-b601', codigo: 'B601', nome: 'Balística' }], avisos: [],
    } });
    render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={vi.fn()} temDadosExistentes={false}
      pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '190' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('button', { name: 'Confirmar tipo e revisar dados' })).toBeDisabled();
    expect(consultarRep).not.toHaveBeenCalled();
  });

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
        onDefinirTipo={vi.fn()}
        onConfigurarCredenciais={vi.fn()}
      />,
    )

    await waitFor(() => expect(testarConexao).toHaveBeenCalledWith('homologacao'))
    await buscarRep()

    expect(screen.queryByText('O campo Funcionamento foi definido automaticamente como "NÃO TESTADO" para as peças importadas nas quais essa informação não foi retornada pelo GDL.')).not.toBeInTheDocument()
  })
  it('abre os detalhes automaticamente e avisa sobre o status sem botões de decisão', async () => {
    const dados = { consultaId: '11111111-1111-4111-8111-111111111111', identificacao: identificarNaturezaExame('B602 - EXAME BALÍSTICO'),
      tiposLocais: [{ id: 'tipo-b602', codigo: 'B-602', nome: 'Balística' }], avisos: [] };
    identificarRep.mockResolvedValue({ success: true, data: { ...dados, detalhes: { estado: 'aguardando_confirmacao', statusAtual: 'ABERTA E DISTRIBUÍDA', motivoConfirmacao: 'Abrir os detalhes pode alterar para Laudo em Execução.' } } });
    completarConsultaRep.mockResolvedValue({ success: true, data: { ...dados, detalhes: { estado: 'confirmados', statusAtual: 'ABERTA E DISTRIBUÍDA', origemNatureza: 'detalhes' } } });
    render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={vi.fn()} temDadosExistentes={false} pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
    expect(screen.getByText('Status da REP no GDL')).toBeInTheDocument();
    expect(screen.getByText('Laudo em Execução')).toHaveClass('bg-amber-100', 'text-amber-800');
    expect(completarConsultaRep).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Nº da REP'), { target: { value: '190' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(completarConsultaRep).toHaveBeenCalledWith(dados.consultaId, true));
    expect(await screen.findByText('Natureza confirmada na página da REP.')).toBeInTheDocument();
    expect(screen.queryByText('Status da REP no GDL')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar e abrir detalhes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar somente dados da API' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar tipo e revisar dados' })).toBeEnabled();
    expect(completarConsultaRep).toHaveBeenCalledTimes(1);
  });
  it('avisa sobre B601 sem cadastro local e copia o e-mail sem tentar converter', async () => {
    identificarRep.mockResolvedValueOnce({ success: true, data: {
      consultaId: '11111111-1111-4111-8111-111111111111', identificacao: identificarNaturezaExame('B601 - EXAME DE CONSTATAÇÃO'),
      tiposLocais: [], avisos: [], codigosImportacaoDisponiveis: ['B-602'],
    } });
      render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={vi.fn()} temDadosExistentes={false} pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Nº da REP'), { target: { value: '190' } });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      expect(await screen.findByText('Exame ainda em desenvolvimento')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Dúvidas/Sugestões' }));
      await waitFor(() => expect(copiarEmailSuporte).toHaveBeenCalledWith());
      expect(screen.getByRole('button', { name: 'Confirmar tipo e revisar dados' })).toBeDisabled();
      expect(consultarRep).not.toHaveBeenCalled();
  });

  it('oferece limpeza de campo vazio confirmado somente por escolha explícita', async () => {
    consultarRep.mockResolvedValue({ success: true, data: { ...resultadoConsulta, camposVaziosConfirmados: ['observacoes'], camposGerais: { ...resultadoConsulta.camposGerais, observacoes: '' } } });
    const aplicar = vi.fn();
    render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={aplicar} temDadosExistentes={false} pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
    await buscarRep();
    const limpeza = screen.getByRole('checkbox', { name: /Limpar quesito/ });
    expect(limpeza).not.toBeChecked();
    fireEvent.click(limpeza);
    fireEvent.click(screen.getByRole('button', { name: 'Preencher formulário' }));
    await waitFor(() => expect(aplicar).toHaveBeenCalled());
    expect(aplicar.mock.calls[0][0].limpezasSelecionadas).toEqual(['observacoes']);
  });

  it.each(['B-601', 'B-602'])('avança direto para revisão de %s explícito sem preencher o formulário', async codigo => {
    const tipoId = codigo === 'B-601' ? 'tipo-b601' : 'tipo-b602';
    consultarRep.mockResolvedValueOnce({ success: true, data: {
      ...resultadoConsulta, codigoExame: codigo, naturezaExameGdl: codigo + ' - EXAME',
      avisos: [
        { codigo: 'CAMPOS_B601_PARA_REVISAO', mensagem: 'Aviso de campos adicionais' },
        { codigo: 'TIPO_PECA_NAO_CONFIRMADO', mensagem: 'Tipo de peça desconhecido' },
      ],
      camposGerais: Object.fromEntries(Object.entries(resultadoConsulta.camposGerais).map(([chave, valor]) => [chave.replace('b602_', codigo === 'B-601' ? 'b601_' : 'b602_'), valor])),
    } });
    identificarRep.mockResolvedValueOnce({ success: true, data: {
      consultaId: '11111111-1111-4111-8111-111111111111', identificacao: identificarNaturezaExame(codigo + ' - EXAME'),
      tiposLocais: [{ id: tipoId, codigo, nome: 'Exame local' }], codigosImportacaoDisponiveis: [codigo], avisos: [],
    } });
    const aplicar = vi.fn();
    const definirTipo = vi.fn();
    render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={aplicar} temDadosExistentes={false}
      pecasB602={[]} onDefinirTipo={definirTipo} onConfigurarCredenciais={vi.fn()} />);
    await buscarRep();
    expect(consultarRep).toHaveBeenCalledExactlyOnceWith('11111111-1111-4111-8111-111111111111', tipoId);
    expect(screen.queryByRole('button', { name: 'Confirmar tipo e revisar dados' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preencher formulário' })).toBeEnabled();
    expect(screen.getByText(codigo + ' - EXAME')).toBeInTheDocument();
    expect(screen.queryByText('Aviso de campos adicionais') !== null).toBe(codigo !== 'B-601');
    expect(screen.getByText('Tipo de peça desconhecido')).toBeInTheDocument();
    expect(aplicar).not.toHaveBeenCalled();
    expect(definirTipo).not.toHaveBeenCalled();
  });

  it.each(['ambigua', 'duplicada', 'ausente', 'divergente', 'detalhes_divergentes', 'sem_adaptador', 'sem_capacidades'])('mantém confirmação quando identificação é %s', async cenario => {
    const codigo = 'B-602';
    const tipo = { id: 'tipo-b602', codigo, nome: 'Balística' };
    identificarRep.mockResolvedValueOnce({ success: true, data: {
      consultaId: '11111111-1111-4111-8111-111111111111',
      identificacao: identificarNaturezaExame(cenario === 'ambigua' ? 'EXAME DE CONSTATAÇÃO' : 'B602 - EXAME BALÍSTICO'),
      tiposLocais: cenario === 'ausente' ? [] : cenario === 'duplicada' ? [tipo, { ...tipo, id: 'outro-b602' }] : [tipo],
      ...(cenario === 'sem_capacidades' ? {} : { codigosImportacaoDisponiveis: cenario === 'sem_adaptador' ? [] : [codigo] }),
      ...(cenario === 'detalhes_divergentes' ? { detalhes: { estado: 'confirmados', statusAtual: null, divergencia: true } } : {}),
      avisos: [],
    } });
    render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={vi.fn()} temDadosExistentes={false}
      tipoExameAtualId={cenario === 'divergente' ? 'tipo-b601' : undefined}
      pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '190' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('button', { name: 'Confirmar tipo e revisar dados' })).toBeInTheDocument();
    expect(consultarRep).not.toHaveBeenCalled();
  });

  it('exibe falha da conversão automática na identificação e permite tentar novamente', async () => {
    consultarRep.mockResolvedValueOnce({ success: false, error: 'Falha de conversão simulada' });
    const aplicar = vi.fn();
    render(<GdlConsultaModal open onOpenChange={vi.fn()} onAplicar={aplicar} temDadosExistentes={false}
      pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '190' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('Falha de conversão simulada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar tipo e revisar dados' }));
    expect(await screen.findByRole('button', { name: 'Preencher formulário' })).toBeEnabled();
    expect(identificarRep).toHaveBeenCalledTimes(1);
    expect(consultarRep).toHaveBeenCalledTimes(2);
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('ignora conversão automática que termina depois do cancelamento', async () => {
    let concluir: (resposta: unknown) => void = () => { throw new Error('Conversão não iniciada'); };
    consultarRep.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
    const aplicar = vi.fn();
    const fechar = vi.fn();
    render(<GdlConsultaModal open onOpenChange={fechar} onAplicar={aplicar} temDadosExistentes={false}
      pecasB602={[]} onDefinirTipo={vi.fn()} onConfigurarCredenciais={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Nº da REP'), { target: { value: '190' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(consultarRep).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => { concluir({ success: true, data: resultadoConsulta }); });
    expect(fechar).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('button', { name: 'Preencher formulário' })).not.toBeInTheDocument();
    expect(aplicar).not.toHaveBeenCalled();
  });

})
