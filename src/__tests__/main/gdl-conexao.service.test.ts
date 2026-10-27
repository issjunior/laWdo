import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConexaoGdlService, type ContextoConexaoGdl } from '../../main/services/gdl-conexao.service';
import { aparenciaConexaoGdl } from '../../shared/gdl/conexao';

describe('estado da conexão GDL', () => {
  let contexto: ContextoConexaoGdl;
  let verificar: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  let servico: ConexaoGdlService;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
    contexto = { ambiente: 'producao', identidade: 'configuracao-a', baseUrl: 'https://gdl.exemplo/api',
      autorizacao: 'Basic exemplo', credenciaisConfiguradas: true, validadoEm: '2026-10-23T12:00:00Z' };
    verificar = vi.fn().mockResolvedValue(true);
    servico = new ConexaoGdlService({ obterContexto: async () => ({ ...contexto }), verificar });
  });
  afterEach(() => { vi.useRealTimers(); });
  const endereco = 'https://gdl.exemplo/api/rep/obter';

  it('não presume rede disponível pela validação persistida, mas aceita a validação após checar rede', async () => {
    expect(aparenciaConexaoGdl(await servico.obterEstado())).toBe('desconhecida');
    const estado = await servico.verificar();
    expect(estado.credenciaisValidadasEm).toBe('2026-10-23T12:00:00Z');
    expect(aparenciaConexaoGdl(estado)).toBe('disponivel');
    expect(verificar).toHaveBeenCalledTimes(1);
  });

  it('checa rede sem credenciais e informa ausência ou validação pendente', async () => {
    contexto.credenciaisConfiguradas = false;
    contexto.validadoEm = null;
    expect((await servico.verificar()).credenciais).toBe('ausentes');
    expect(aparenciaConexaoGdl(await servico.obterEstado())).toBe('atencao');
    contexto.identidade = 'configuracao-b';
    contexto.credenciaisConfiguradas = true;
    expect((await servico.verificar()).credenciais).toBe('pendentes');
  });

  it('compartilha a checagem e preserva a última aparência enquanto verifica', async () => {
    await servico.verificar();
    let concluir!: (sucesso: boolean) => void;
    verificar.mockImplementation(() => new Promise(resolver => { concluir = resolver; }));
    const primeira = servico.verificar();
    const segunda = servico.verificar();
    await vi.waitFor(() => expect(concluir).toBeTypeOf('function'));
    expect(verificar).toHaveBeenCalledTimes(2);
    const durante = await servico.obterEstado();
    expect(durante.verificando).toBe(true);
    expect(aparenciaConexaoGdl(durante)).toBe('disponivel');
    concluir(false);
    const [resultado, compartilhado] = await Promise.all([primeira, segunda]);
    expect(resultado).toEqual(compartilhado);
    expect(resultado.verificando).toBe(false);
    expect(aparenciaConexaoGdl(resultado)).toBe('indisponivel');
    verificar.mockResolvedValueOnce(true);
    expect(aparenciaConexaoGdl(await servico.verificar())).toBe('disponivel');
  });

  it('expira a evidência após 120 segundos sem renovar o horário em leituras locais', async () => {
    const inicial = await servico.verificar();
    vi.advanceTimersByTime(120_000);
    expect(aparenciaConexaoGdl(await servico.obterEstado())).toBe('disponivel');
    vi.advanceTimersByTime(1);
    const atual = await servico.obterEstado();
    expect(atual.redeVerificadaEm).toBe(inicial.redeVerificadaEm);
    expect(aparenciaConexaoGdl(atual)).toBe('desconhecida');
    expect(verificar).toHaveBeenCalledTimes(1);
  });

  it('sucesso de rede não apaga rejeição de autenticação nem falha web', async () => {
    const observacao = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarAutenticacao(observacao, false);
    servico.registrarWeb(observacao, false);
    let estado = await servico.verificar();
    expect(estado).toMatchObject({ rede: 'acessivel', credenciais: 'rejeitadas', web: 'atencao' });
    const autenticada = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarAutenticacao(autenticada, true);
    estado = await servico.obterEstado();
    expect(estado.credenciais).toBe('validadas');
    expect(aparenciaConexaoGdl(estado)).toBe('atencao');
    servico.registrarWeb(await servico.capturarRequisicao(endereco), true);
    expect(aparenciaConexaoGdl(await servico.obterEstado())).toBe('disponivel');
  });

  it('respostas sem autenticação não validam nem rejeitam credenciais', async () => {
    contexto.validadoEm = null;
    const observacao = await servico.capturarRequisicao(endereco);
    servico.registrarRede(observacao, true);
    servico.registrarAutenticacao(observacao, true);
    servico.registrarAutenticacao(observacao, false);
    expect((await servico.obterEstado()).credenciais).toBe('pendentes');
    expect(await servico.capturarRequisicao(endereco, 'Basic outra')).toBeNull();
    expect(await servico.capturarRequisicao('https://outro.exemplo/api')).toBeNull();
  });

  it('falha apenas no acesso web preserva a disponibilidade e a autenticação da API', async () => {
    await servico.verificar();
    const observacao = await servico.capturarRequisicao(endereco);
    servico.registrarWeb(observacao, false);
    expect(await servico.obterEstado()).toMatchObject({ rede: 'acessivel', credenciais: 'validadas', web: 'atencao' });
  });

  it('descarta observações e checagem em andamento da configuração anterior', async () => {
    const antiga = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    let concluir!: (sucesso: boolean) => void;
    verificar.mockImplementationOnce(() => new Promise(resolver => { concluir = resolver; }));
    const pendente = servico.verificar();
    await vi.waitFor(() => expect(concluir).toBeTypeOf('function'));
    contexto = { ...contexto, ambiente: 'homologacao', identidade: 'configuracao-b', validadoEm: null };
    servico.contextoAlterado();
    await servico.obterEstado();
    servico.registrarAutenticacao(antiga, true);
    servico.registrarWeb(antiga, false);
    concluir(false);
    expect(await pendente).toMatchObject({ ambiente: 'homologacao', rede: 'desconhecida', credenciais: 'pendentes', web: 'desconhecida' });
    expect(aparenciaConexaoGdl(await servico.verificar())).toBe('atencao');
  });

  it('uma requisição antiga não sobrescreve evidência mais recente', async () => {
    const antiga = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    const recente = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarRede(recente, true);
    servico.registrarAutenticacao(recente, false);
    servico.registrarRede(antiga, false);
    servico.registrarAutenticacao(antiga, true);
    expect(await servico.obterEstado()).toMatchObject({ rede: 'acessivel', credenciais: 'rejeitadas' });
  });

  it('isola ouvintes removidos e trata falhas do verificador como indisponibilidade', async () => {
    const ouvinte = vi.fn();
    const remover = servico.observar(ouvinte);
    verificar.mockRejectedValueOnce(new Error('Timeout'));
    expect(aparenciaConexaoGdl(await servico.verificar())).toBe('indisponivel');
    expect(ouvinte).toHaveBeenCalled();
    remover();
    ouvinte.mockClear();
    await servico.verificar();
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
