import { describe, expect, it } from 'vitest';
import {
  calcularOrcamentoEntradaIa,
  listarModelosIa,
  obterModeloIa,
  obterModeloPadraoIa,
} from '@shared/catalogos/modelos-ia.catalogo';

describe('catálogo central de modelos de IA', () => {
  it('mantém modelos separados por provedor e aplica fallback seguro', () => {
    expect(listarModelosIa('groq').every(modelo => modelo.provedor === 'groq')).toBe(true);
    expect(obterModeloIa('gemini', 'modelo-inexistente')).toEqual(obterModeloPadraoIa('gemini'));
  });

  it('deriva um orçamento de entrada abaixo da janela disponível', () => {
    const modelo = obterModeloPadraoIa('gemini');
    const orcamento = calcularOrcamentoEntradaIa(modelo);

    expect(orcamento).toBeGreaterThan(0);
    expect(orcamento).toBeLessThan(modelo.janelaContextoCaracteres - modelo.reservaRespostaCaracteres);
  });

  it('concentra capacidades multimodais no próprio modelo', () => {
    const modelo = obterModeloIa('groq', 'meta-llama/llama-4-scout-17b-16e-instruct');

    expect(modelo.suportaVisao).toBe(true);
    expect(modelo.mimesImagem).toContain('image/jpeg');
    expect(modelo.limiteBytesImagem).toBeGreaterThan(0);
  });
});
