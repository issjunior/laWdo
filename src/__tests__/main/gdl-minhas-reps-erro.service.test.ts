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
});
