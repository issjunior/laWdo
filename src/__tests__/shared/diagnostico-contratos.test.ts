import { describe, expect, it } from 'vitest';
import {
  criarRespostaDiagnosticoErro,
  criarRespostaDiagnosticoSucesso,
  gerarSchemasJsonFerramentasDiagnostico,
  schemaExecutarAcaoEntrada,
  schemaInspecionarInterfaceEntrada,
  schemaIniciarCapturaEntrada,
  schemaFinalizarCapturaEntrada,
  schemaObterEventosEntrada,
} from '@shared/diagnostico/contratos.js';

describe('contratos de diagnóstico assistido', () => {
  it('aplica os limites e valores padrão da inspeção', () => {
    expect(schemaInspecionarInterfaceEntrada.parse({})).toEqual({
      limiteElementos: 500,
      profundidadeMaxima: 12,
    });
    expect(schemaInspecionarInterfaceEntrada.safeParse({ limiteElementos: 1001 }).success).toBe(false);
  });

  it('rejeita filtros vazios e propriedades adicionais', () => {
    expect(schemaObterEventosEntrada.safeParse({ categorias: [] }).success).toBe(false);
    expect(schemaObterEventosEntrada.safeParse({ inesperado: true }).success).toBe(false);
  });

  it('aceita somente ações discriminadas válidas', () => {
    expect(schemaExecutarAcaoEntrada.safeParse({
      janelaId: 1,
      revisao: 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
      elementoId: 'e-1',
      acao: { tipo: 'digitar', texto: 'conteúdo', modo: 'substituir' },
    }).success).toBe(true);
    expect(schemaExecutarAcaoEntrada.safeParse({
      janelaId: 1,
      revisao: 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
      elementoId: 'e-1',
      acao: { tipo: 'digitar', texto: 'conteúdo' },
    }).success).toBe(false);
  });

  it('valida as finalidades de captura e suas entradas mutuamente exclusivas', () => {
    expect(schemaIniciarCapturaEntrada.parse({
      finalidade: 'problema',
      cenario: 'A rolagem salta ao abrir uma seção com imagens.',
    })).toMatchObject({ finalidade: 'problema' });
    expect(schemaIniciarCapturaEntrada.parse({ finalidade: 'desempenho' })).toMatchObject({
      finalidade: 'desempenho', duracaoSegundos: 60, cenarioDesempenho: 'geral',
    });
    expect(schemaIniciarCapturaEntrada.safeParse({ finalidade: 'problema', cenario: 'curto' }).success).toBe(false);
    expect(schemaIniciarCapturaEntrada.safeParse({ finalidade: 'desempenho', categorias: ['acao'] }).success).toBe(false);
    expect(schemaFinalizarCapturaEntrada.safeParse({
      capturaId: 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca', resultadoUsuario: 'falhou',
    }).success).toBe(false);
  });

  it('gera schemas JSON fechados para as dez ferramentas', () => {
    const schemas = gerarSchemasJsonFerramentasDiagnostico();
    expect(Object.keys(schemas)).toHaveLength(10);
    expect(schemas.executar_acao).toMatchObject({ type: 'object', additionalProperties: false });
    expect(schemas.iniciar_captura).toMatchObject({ oneOf: expect.any(Array) });
  });

  it('mantém o envelope estruturado estável para sucesso e erro', () => {
    expect(criarRespostaDiagnosticoSucesso('f0d43c3b-5ff8-4e40-bef2-09444f6693ca', null, { conectado: false })).toMatchObject({
      ok: true,
      versaoProtocolo: 1,
      sessionId: null,
    });
    expect(criarRespostaDiagnosticoErro(
      'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
      null,
      'SESSAO_INDISPONIVEL',
      'Inicie o modo diagnóstico.',
      true,
    )).toMatchObject({ ok: false, erro: { codigo: 'SESSAO_INDISPONIVEL', recuperavel: true } });
  });
});
