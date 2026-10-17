import { describe, expect, it } from 'vitest';
import { classificarFalhaListaRepsGdl } from '../../main/services/gdl-minhas-reps-erro.service';

describe('classificação das falhas da lista de REPs do GDL', () => {
  it.each([
    ['Credenciais não configuradas.', 'credenciais', 'configuracao'],
    ['Não foi possível autenticar a sessão web do GDL (validar_login_http_200).', 'autenticacao', 'login_web'],
    ['Não foi possível autenticar a sessão web do GDL (validar_formulario).', 'estrutura', 'formulario_login'],
    ['TimeoutError', 'tempo_esgotado', 'rede_gdl'],
    ['A sessão de Minhas REPs não está disponível no GDL (HTTP 403).', 'autenticacao', 'login_web'],
    ['Não foi possível abrir Minhas REPs no GDL (HTTP 429).', 'limite_gdl', 'rede_gdl'],
    ['Não foi possível abrir Minhas REPs no GDL.', 'servidor', 'abrir_lista'],
    ['O GDL solicitou nova autenticação ao abrir Minhas REPs.', 'sessao', 'sessao_web'],
    ['A sessão da listagem de REPs é inválida.', 'sessao', 'sessao_web'],
    ['A grade Minhas REPs não foi encontrada na resposta do GDL.', 'estrutura', 'interpretar_lista'],
    ['Não foi possível consultar todos os códigos de exame do GDL.', 'detalhes_reps', 'detalhes_reps'],
    ['A paginação do GDL mudou durante a consulta.', 'lista_inconsistente', 'conferir_lista'],
  ])('distingue %s', (mensagem, codigo, etapa) => {
    expect(classificarFalhaListaRepsGdl(new Error(mensagem))).toMatchObject({ codigo, etapa });
  });

  it('distingue erro de rede e omite endereços dos detalhes', () => {
    const resultado = classificarFalhaListaRepsGdl(new Error('fetch failed https://usuario:senha@gdl.exemplo/api'));
    expect(resultado.codigo).toBe('rede');
    expect(resultado.detalhes).not.toContain('usuario:senha');
  });

  it('distingue falha local e limita os detalhes de erro desconhecido', () => {
    expect(classificarFalhaListaRepsGdl(Object.assign(new Error('sem espaço'), { code: 'ENOSPC' })).codigo).toBe('cache_local');
    expect(classificarFalhaListaRepsGdl(new Error('informação externa não verificada'))).toMatchObject({
      codigo: 'inesperado',
      detalhes: 'Falha inesperada (Error).',
    });
  });
  it.each([
    ['ECONNREFUSED', 'rede'], ['ENOTFOUND', 'rede'], ['ETIMEDOUT', 'tempo_esgotado'], ['ERR_CONNECTION_TIMED_OUT', 'tempo_esgotado'],
  ])('preserva %s nas causas encadeadas e durante o bloqueio', (code, codigo) => {
    const original = Object.assign(new Error('falha de transporte'), { code });
    const intermediario = new Error('fetch failed', { cause: original });
    const erro = Object.assign(new Error('Não foi possível autenticar a sessão web do GDL.', { cause: intermediario }), { etapa: 'carregar_formulario' });
    expect(classificarFalhaListaRepsGdl(erro)).toMatchObject({ codigo, codigoSistema: code, etapa: 'carregar_formulario' });
    const bloqueado = Object.assign(new Error('Nova tentativa temporariamente bloqueada.', { cause: erro }), { tentarNovamenteEmSegundos: 42 });
    expect(classificarFalhaListaRepsGdl(bloqueado)).toMatchObject({ codigo, codigoSistema: code, bloqueioTemporario: true, tentarNovamenteEmSegundos: 42 });
  });

  it.each([[404, 'servidor'], [401, 'autenticacao'], [403, 'autenticacao'], [429, 'limite_gdl'], [503, 'servidor'], [504, 'tempo_esgotado']])('preserva HTTP %i durante login', (statusHttp, codigo) => {
    const erro = Object.assign(new Error('Página de autenticação indisponível.'), { statusHttp, etapa: 'carregar_formulario' });
    expect(classificarFalhaListaRepsGdl(erro)).toMatchObject({ codigo, statusHttp, etapa: 'carregar_formulario' });
  });

  it('limita cadeias cíclicas e não expõe códigos técnicos arbitrários', () => {
    const erro = Object.assign(new Error('externo'), { code: 'SEGREDO', cause: {} });
    erro.cause = erro;
    expect(classificarFalhaListaRepsGdl(erro)).toMatchObject({ codigo: 'inesperado', codigoSistema: undefined });
    expect(classificarFalhaListaRepsGdl(erro).detalhes).not.toContain('SEGREDO');
  });

  it('distingue permissão negada na conexão de permissão ao salvar cache', () => {
    const erro = new TypeError('fetch failed', { cause: Object.assign(new Error('acesso negado'), { code: 'EACCES', syscall: 'connect' }) });
    expect(classificarFalhaListaRepsGdl(erro)).toMatchObject({ codigo: 'rede', codigoSistema: 'EACCES' });
    expect(classificarFalhaListaRepsGdl(Object.assign(new Error('arquivo'), { code: 'EACCES' }))).toMatchObject({ codigo: 'cache_local' });
  });

});
