import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConexaoGdlService, type ContextoConexaoGdl } from '../../main/services/gdl-conexao.service';
import { aparenciaConexaoGdl, apresentarConexaoGdl } from '../../shared/gdl/conexao';

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

  it('não transforma validação persistida ou teste de rede em acesso autenticado recente', async () => {
    expect(aparenciaConexaoGdl(await servico.obterEstado())).toBe('desconhecida');
    const estado = await servico.verificar();
    expect(estado.credenciaisValidadasEm).toBe('2026-10-23T12:00:00Z');
    expect(aparenciaConexaoGdl(estado)).toBe('acessivel');
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
    expect(aparenciaConexaoGdl(durante)).toBe('acessivel');
    concluir(false);
    const [resultado, compartilhado] = await Promise.all([primeira, segunda]);
    expect(resultado).toEqual(compartilhado);
    expect(resultado.verificando).toBe(false);
    expect(aparenciaConexaoGdl(resultado)).toBe('indisponivel');
    verificar.mockResolvedValueOnce(true);
    expect(aparenciaConexaoGdl(await servico.verificar())).toBe('acessivel');
  });

  it('mantém a evidência por tempo indeterminado sem renovar o horário em leituras locais', async () => {
    const inicial = await servico.verificar();
    vi.advanceTimersByTime(120_000);
    expect(aparenciaConexaoGdl(await servico.obterEstado())).toBe('acessivel');
    vi.advanceTimersByTime(1);
    const atual = await servico.obterEstado();
    expect(atual.redeVerificadaEm).toBe(inicial.redeVerificadaEm);
    expect(aparenciaConexaoGdl(atual)).toBe('acessivel');
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
    expect(aparenciaConexaoGdl(estado)).toBe('disponivel');
    servico.registrarWeb(await servico.capturarRequisicao(endereco, contexto.autorizacao), true);
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
    expect(aparenciaConexaoGdl(await servico.verificar())).toBe('acessivel');
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
  it('preserva acesso web confirmado sem renovar o horário em sondagens de rede', async () => {
    contexto.validadoEm = null;
    const observacao = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarWeb(observacao, true);
    const inicial = await servico.obterEstado();
    expect(inicial.credenciais).toBe('pendentes');
    expect(apresentarConexaoGdl(inicial).mensagem).toBe('Acesso ao GDL confirmado');
    vi.advanceTimersByTime(120_001);
    const atual = await servico.verificar();
    expect(atual.acessoAutenticado?.confirmadoEm).toBe(inicial.acessoAutenticado?.confirmadoEm);
    expect(apresentarConexaoGdl(atual).mensagem).toBe('Acesso ao GDL confirmado');
  });

  it('ordena evidências de API e web sem alterar seus estados técnicos independentes', async () => {
    const antiga = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    const recente = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarWeb(recente, true);
    servico.registrarAutenticacao(antiga, false);
    let estado = await servico.obterEstado();
    expect(estado.credenciais).toBe('rejeitadas');
    expect(apresentarConexaoGdl(estado).mensagem).toBe('Acesso ao GDL confirmado');
    const rejeitada = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarWeb(rejeitada, false, true);
    estado = await servico.obterEstado();
    expect(apresentarConexaoGdl(estado).mensagem).toBe('Confira suas credenciais');
    await servico.verificar();
    expect(apresentarConexaoGdl(await servico.obterEstado()).mensagem).toBe('Confira suas credenciais');
    const recuperada = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarAutenticacao(recuperada, true);
    expect(apresentarConexaoGdl(await servico.obterEstado()).mensagem).toBe('Acesso ao GDL confirmado');
  });

  it('descarta confirmação atrasada após limpar a validação e após trocar identidade', async () => {
    const antiga = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.limparAutenticacao('producao');
    servico.registrarWeb(antiga, true);
    expect((await servico.obterEstado()).acessoAutenticado).toBeNull();
    const atual = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarAutenticacao(atual, true);
    contexto.identidade = 'configuracao-nova';
    expect((await servico.obterEstado()).acessoAutenticado).toBeNull();
    servico.registrarAutenticacao(atual, true);
    expect((await servico.obterEstado()).acessoAutenticado).toBeNull();
  });

  it('deduplica estados, registra recuperação e não envia dados privados ao logger', async () => {
    const registrarMudanca = vi.fn();
    servico = new ConexaoGdlService({ obterContexto: async () => ({ ...contexto }), verificar, registrarMudanca });
    await servico.verificar();
    registrarMudanca.mockClear();
    await servico.verificar();
    expect(registrarMudanca).not.toHaveBeenCalled();
    const rejeitada = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarAutenticacao(rejeitada, false);
    const quantidade = registrarMudanca.mock.calls.length;
    const repetida = await servico.capturarRequisicao(endereco, contexto.autorizacao);
    servico.registrarAutenticacao(repetida, false);
    expect(registrarMudanca).toHaveBeenCalledTimes(quantidade);
    servico.registrarWeb(await servico.capturarRequisicao(endereco, contexto.autorizacao), true);
    expect(registrarMudanca).toHaveBeenCalledWith(expect.objectContaining({ ambiente: 'producao', operacao: 'acesso_autenticado', resultado: 'sucesso' }));
    const dados = JSON.stringify(registrarMudanca.mock.calls);
    for (const privado of [contexto.identidade, contexto.autorizacao, contexto.baseUrl, 'cpf', 'cookie', 'senha']) {
      expect(dados.toLowerCase()).not.toContain(privado.toLowerCase());
    }
    registrarMudanca.mockImplementation(() => { throw new Error('Logger indisponível'); });
    expect(() => servico.registrarAutenticacao(repetida, true)).not.toThrow();
  });

  it('publica somente o resultado completo e recupera rede e acesso atomicamente', async () => {
    const eventos: Awaited<ReturnType<typeof servico.obterEstado>>[] = [];
    servico.observar(estado => eventos.push(estado));
    await servico.executarOperacao('web', async () => {
      const observacao = await servico.capturarRequisicao(endereco, contexto.autorizacao);
      servico.registrarWeb(observacao, true);
      servico.registrarRede(observacao, true);
      expect(eventos).toHaveLength(0);
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ rede: 'acessivel', acessoAutenticado: { resultado: 'sucesso' } });
    await expect(servico.executarOperacao('web', async () => {
      await servico.capturarRequisicao(endereco, contexto.autorizacao);
      await servico.executarOperacao('web', async () => {
        const observacao = await servico.capturarRequisicao(endereco, contexto.autorizacao);
        servico.registrarWeb(observacao, true);
      });
      expect(eventos).toHaveLength(1);
      throw new Error('Grade em formato inesperado');
    })).rejects.toThrow();
    expect(eventos).toHaveLength(2);
    expect(apresentarConexaoGdl(eventos[1]).aparencia).toBe('atencao');
    await servico.verificar();
    expect(apresentarConexaoGdl(await servico.obterEstado()).aparencia).toBe('atencao');
    await servico.executarOperacao('api', async () => { await servico.capturarRequisicao(endereco, contexto.autorizacao); });
    expect(apresentarConexaoGdl(await servico.obterEstado()).aparencia).toBe('disponivel');
    eventos.forEach((estado, indice) => { if (indice) expect(estado.versaoEstado).toBeGreaterThan(eventos[indice - 1].versaoEstado); });
  });

  it.each([
    Object.assign(new Error('HTTP 503'), { statusHttp: 503 }),
    Object.assign(new Error('Falha TLS'), { code: 'ERR_CERT_AUTHORITY_INVALID' }),
    new Error('Grade em formato inesperado'),
    new Error('Resposta de detalhe indisponível'),
    new Error('sessão expirada'),
  ])('uma falha não transitória de recuperação invalida sucesso e resiste à sondagem: %s', async falha => {
    servico.registrarWeb(await servico.capturarRequisicao(endereco, contexto.autorizacao), true);
    await expect(servico.executarOperacao('web', async () => {
      await servico.capturarRequisicao(endereco, contexto.autorizacao);
      throw falha;
    })).rejects.toThrow();
    expect(apresentarConexaoGdl(await servico.obterEstado()).aparencia).not.toBe('disponivel');
    await servico.verificar();
    expect(apresentarConexaoGdl(await servico.obterEstado()).aparencia).not.toBe('disponivel');
  });

  it.each([
    Object.assign(new Error('Sem rede'), { code: 'ENOTFOUND' }),
    Object.assign(new Error('Tempo esgotado'), { code: 'ETIMEDOUT' }),
  ])('sondagem positiva mais recente supera visualmente uma falha transitória: %s', async falha => {
    await expect(servico.executarOperacao('web', async () => {
      await servico.capturarRequisicao(endereco, contexto.autorizacao);
      throw falha;
    })).rejects.toThrow();
    expect(apresentarConexaoGdl(await servico.obterEstado()).aparencia).toBe('indisponivel');
    vi.advanceTimersByTime(1);
    let estado = await servico.verificar();
    expect(apresentarConexaoGdl(estado)).toMatchObject({ aparencia: 'acessivel', mensagem: 'Conexão disponível' });
    expect(apresentarConexaoGdl(estado).mensagem).not.toBe('Acesso ao GDL confirmado');
    verificar.mockResolvedValueOnce(false);
    vi.advanceTimersByTime(1);
    estado = await servico.verificar();
    expect(apresentarConexaoGdl(estado).aparencia).toBe('indisponivel');
  });

  it('cache, cancelamento e falha local não substituem a última evidência de recuperação', async () => {
    servico.registrarWeb(await servico.capturarRequisicao(endereco, contexto.autorizacao), true);
    const anterior = (await servico.obterEstado()).acessoAutenticado;
    await servico.executarOperacao('web', async () => ({ reps: [] }));
    for (const falha of [new Error('Consulta cancelada.'), new Error('A listagem de REPs do GDL está desativada.'), Object.assign(new Error('Sem espaço'), { code: 'ENOSPC' })]) {
      await expect(servico.executarOperacao('web', async () => {
        await servico.capturarRequisicao(endereco, contexto.autorizacao); throw falha;
      })).rejects.toThrow();
    }
    expect((await servico.obterEstado()).acessoAutenticado).toEqual(anterior);
  });

  it('descarta conclusão antiga depois de resultado mais recente no mesmo contexto', async () => {
    let concluir!: () => void;
    let iniciou!: () => void;
    const iniciada = new Promise<void>(resolver => { iniciou = resolver; });
    const antiga = servico.executarOperacao('web', async () => {
      await servico.capturarRequisicao(endereco, contexto.autorizacao); iniciou();
      await new Promise<void>(resolver => { concluir = resolver; });
    });
    await iniciada;
    await expect(servico.executarOperacao('web', async () => {
      await servico.capturarRequisicao(endereco, contexto.autorizacao); throw new Error('HTTP 503');
    })).rejects.toThrow();
    concluir(); await antiga;
    expect((await servico.obterEstado()).acessoAutenticado?.resultado).toBe('falha');
  });

  it('dados parciais e falha auxiliar preservam o retorno útil sem confirmar recuperação completa', async () => {
    const resultado = await servico.executarOperacao('api', async () => {
      await servico.capturarRequisicao(endereco, contexto.autorizacao);
      return { sucesso: true, erroNaturezaExame: 'Natureza não recuperada' };
    });
    expect(resultado.sucesso).toBe(true);
    expect((await servico.obterEstado()).acessoAutenticado?.resultado).toBe('falha');
    await servico.executarOperacao('api', async () => {
      await servico.capturarRequisicao(endereco, contexto.autorizacao);
      servico.registrarFalhaRecuperacao(new Error('Resposta de detalhe indisponível'));
      return { sucesso: true };
    });
    expect((await servico.obterEstado()).acessoAutenticado?.motivo).toBe('detalhes_reps');
  });

  it('falha da sondagem invalida a confirmação e uma nova sondagem não a reutiliza', async () => {
    servico.registrarWeb(await servico.capturarRequisicao(endereco, contexto.autorizacao), true);
    vi.advanceTimersByTime(60 * 60_000);
    expect(apresentarConexaoGdl(await servico.obterEstado()).mensagem).toBe('Acesso ao GDL confirmado');
    verificar.mockResolvedValueOnce(false);
    const falha = await servico.verificar();
    expect(falha.ultimoTesteRede).toMatchObject({ sucesso: false, duracaoMs: expect.any(Number) });
    expect(falha.acessoAutenticado?.confirmadoEm).toBeNull();
    expect(apresentarConexaoGdl(falha).aparencia).toBe('indisponivel');
    const recuperada = await servico.verificar();
    expect(recuperada.ultimoTesteRede?.sucesso).toBe(true);
    expect(apresentarConexaoGdl(recuperada).mensagem).toBe('Conexão disponível');
    servico.registrarWeb(await servico.capturarRequisicao(endereco, contexto.autorizacao), true);
    expect(apresentarConexaoGdl(await servico.obterEstado()).mensagem).toBe('Acesso ao GDL confirmado');
  });

  it('mede cada teste, libera tentativas consecutivas e limpa o resultado ao trocar contexto', async () => {
    verificar.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 250)); return true; });
    const primeiro = servico.verificar();
    await vi.advanceTimersByTimeAsync(250);
    const estado = await primeiro;
    expect(estado.ultimoTesteRede).toEqual({ sucesso: true, verificadoEm: new Date(Date.now()).toISOString(), duracaoMs: 250 });
    verificar.mockResolvedValueOnce(false);
    expect((await servico.verificar()).ultimoTesteRede?.sucesso).toBe(false);
    expect(verificar).toHaveBeenCalledTimes(2);
    estado.ultimoTesteRede!.sucesso = false;
    contexto.identidade = 'nova-configuracao';
    expect((await servico.obterEstado()).ultimoTesteRede).toBeNull();
  });

});
