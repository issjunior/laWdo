import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurarObservadorGdl, destinoApiGdlPermitido, observarConsultaGdl, registrarRespostaGdl, resumirRespostaGdl } from '../../main/services/gdl-diagnostico.service';
import { schemaIniciarCapturaEntrada } from '../../shared/diagnostico/contratos';

afterEach(() => configurarObservadorGdl(null));

describe('diagnóstico passivo GDL', () => {
  it('exige ativação em captura de problema e rejeita opção em desempenho', () => {
    expect(schemaIniciarCapturaEntrada.parse({ finalidade: 'problema', cenario: 'Consultar uma REP simulada.' })).toMatchObject({ capturarConsultasGdl: false });
    expect(schemaIniciarCapturaEntrada.safeParse({ finalidade: 'desempenho', capturarConsultasGdl: true }).success).toBe(false);
  });

  it('permite somente pares documentados de leitura', () => {
    const base = 'https://www.gdl.sesp.parana/SAC/GDL_IC_NET';
    expect(destinoApiGdlPermitido(`${base}/api/rep/obter?numero=1&ano=2026`, 'GET')).toBe(true);
    expect(destinoApiGdlPermitido(`${base}/api/repsInvestigacaoPolicial/listarReps`, 'POST')).toBe(true);
    for (const metodo of ['PUT', 'DELETE', 'PATCH', 'POST']) expect(destinoApiGdlPermitido(`${base}/api/rep/obter`, metodo)).toBe(false);
    expect(destinoApiGdlPermitido(`${base}/api/rep/nota`, 'POST')).toBe(false);
    expect(destinoApiGdlPermitido(`${base}/REP/Default.aspx?rep_id=1`, 'GET')).toBe(false);
  });

  it('omite valores livres e identifica datas e classes de andamentos', () => {
    const resumo = resumirRespostaGdl({ senha: 'SEGREDO', nome: 'PESSOA PRIVADA', arquivosAdicionais: [{ nomeArquivo: 'PRIVADO.pdf', fileId: 'TOKEN' }],
      dataHoraEntrada: '2026-08-21T10:10:00', andamentos: [{ dataHora: '2026-08-22T10:30:50', descricao: 'REP aberta por PESSOA PRIVADA', nomeUsuario: 'PESSOA PRIVADA' }] });
    expect(resumo.datas).toContainEqual({ caminho: 'dataHoraEntrada', data: '2026-08-21T10:10:00' });
    expect(resumo.andamentos).toEqual([{ classe: 'abertura', data: '2026-08-22T10:30:50' }]);
    expect(JSON.stringify(resumo)).not.toMatch(/SEGREDO|PESSOA PRIVADA|PRIVADO.pdf|TOKEN/);
    const limitado = resumirRespostaGdl(Object.fromEntries(Array.from({ length: 120 }, (_, indice) => [`campo${indice}`, indice])));
    expect(limitado.campos).toHaveLength(100);
    expect(limitado.truncado).toBe(true);
  });

  it('isola consultas concorrentes por remetente e mantém correlação das subconsultas', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);
    configurarObservadorGdl({ obterCaptura: id => id === 3 ? null : { capturaId: `captura${id}`, janelaId: id }, registrar });
    const consultar = vi.fn(async () => { await registrarRespostaGdl({ etapa: 'resposta_original' }, '{}'); await registrarRespostaGdl({ etapa: 'auxiliar' }, '{}'); return 'dados'; });
    await Promise.all([observarConsultaGdl(1, '123', '2026', consultar), observarConsultaGdl(2, '456', '2025', consultar), observarConsultaGdl(3, '789', '2024', consultar)]);
    expect(consultar).toHaveBeenCalledTimes(3);
    expect(registrar).toHaveBeenCalledTimes(4);
    const primeira = registrar.mock.calls.filter(([contexto]) => contexto.janelaId === 1);
    expect(primeira[0][0].correlacaoId).toBe(primeira[1][0].correlacaoId);
    expect(registrar.mock.calls.filter(([contexto]) => contexto.numero === '789')).toHaveLength(0);
    configurarObservadorGdl({ obterCaptura: () => { throw new Error('Falha de coleta'); }, registrar });
    await expect(observarConsultaGdl(1, '123', '2026', consultar)).resolves.toBe('dados');
    configurarObservadorGdl({ obterCaptura: id => ({ capturaId: 'a', janelaId: id }), registrar: async () => { throw new Error('Falha persistência'); } });
    await expect(observarConsultaGdl(1, '123', '2026', consultar)).resolves.toBe('dados');
  });

  it('preserva nomes Unicode e datas com nomes alternativos sem valores livres', () => {
    const resumo = resumirRespostaGdl({ 'Data de Entrada/Solicitação': '21/08/2026 10:10', 'Data de Recebimento': '2026-08-21T10:10:00',
      origens: [{ data: '2026-08-22T00:00:00' }], peças: [{ 'Nº Série': 'SERIE PRIVADA', 'Arma é Institucional?': 'SIM' }], senha: 'SEGREDO' });
    expect(resumo.campos.map(campo => campo.caminho)).toContain('peças[].Nº Série');
    expect(resumo.campos.map(campo => campo.caminho)).toContain('peças[].Arma é Institucional?');
    expect(resumo.datas).toEqual(expect.arrayContaining([
      { caminho: 'Data de Entrada/Solicitação', data: '21/08/2026 10:10' },
      { caminho: 'Data de Recebimento', data: '2026-08-21T10:10:00' },
      { caminho: 'origens[].data', data: '2026-08-22T00:00:00' },
    ]));
    expect(resumo.motivosOmissao).toEqual([]);
    expect(JSON.stringify(resumo)).not.toMatch(/SEGREDO|SERIE PRIVADA/);
  });

  it('prioriza a raiz e não afirma ausência quando ela está incompleta', () => {
    const aninhado = Object.fromEntries(Array.from({ length: 120 }, (_, indice) => [`campo${indice}`, indice]));
    const raiz = resumirRespostaGdl({ detalhes: aninhado, dataEntradaSolicitacao: '2026-08-21' });
    expect(raiz.campos[2].caminho).toBe('dataEntradaSolicitacao');
    expect(raiz.nivelRaizCompleto).toBe(true);
    expect(raiz.motivosOmissao).toContain('limite_caminhos');
    const incompleto = resumirRespostaGdl(aninhado);
    expect(incompleto.nivelRaizCompleto).toBe(false);
    expect(incompleto.camposDeInteresseAusentes).toEqual([]);
    expect(incompleto.camposDeInteresseNaoConclusivos).toContain('dataEntradaSolicitacao');
    const nomeInvalido = resumirRespostaGdl({ ['campo'.repeat(20) + 'x']: 'texto' });
    expect(nomeInvalido.motivosOmissao).toEqual(['nome_nao_suportado']);
    expect(nomeInvalido.nivelRaizCompleto).toBe(false);
  });

  it('distingue profundidade e limite de exemplos', () => {
    expect(resumirRespostaGdl({ a: { b: { c: { d: { e: { f: 1 } } } } } }).motivosOmissao).toContain('profundidade');
    const exemplos = resumirRespostaGdl({ andamentos: Array.from({ length: 25 }, () => ({ dataHora: '2026-08-22T10:30:50', descricao: 'REP aberta' })) });
    expect(exemplos.datas.length + exemplos.andamentos.length).toBeLessThanOrEqual(20);
    expect(exemplos.motivosOmissao).toContain('limite_exemplos');
  });

  it('descarta respostas tardias após encerramento ou início de outra captura', async () => {
    let captura: string | null = 'primeira';
    let liberar: () => void = () => undefined;
    const esperar = new Promise<void>(resolve => { liberar = resolve; });
    const registrar = vi.fn().mockResolvedValue(undefined);
    configurarObservadorGdl({ obterCaptura: id => captura ? { capturaId: captura, janelaId: id } : null, registrar });
    const pendente = observarConsultaGdl(1, '123', '2026', async () => {
      await esperar;
      await registrarRespostaGdl({ etapa: 'resposta_original' }, '{}');
    });
    captura = null;
    await registrarRespostaGdl({ etapa: 'fora_consulta' }, '{}');
    captura = 'segunda';
    liberar();
    await pendente;
    expect(registrar).not.toHaveBeenCalled();
  });
});
