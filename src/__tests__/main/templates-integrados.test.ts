import { describe, expect, it } from 'vitest';
import { laudoPadraoB602V1 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v1';
import { calcularChecksumTemplateIntegrado } from '../../main/templates/integrados/serializar-template-integrado';
import { validarTemplateIntegrado } from '../../main/templates/integrados/validar-template-integrado';

describe('catálogo de templates integrados', () => {
  it('mantém o B602 estruturado, com seção repetível por arma', () => {
    expect(() => validarTemplateIntegrado(laudoPadraoB602V1)).not.toThrow();
    expect(laudoPadraoB602V1.chave).toBe('laudo-padrao-b602');
    expect(laudoPadraoB602V1.secoes).toHaveLength(8);
    expect(laudoPadraoB602V1.secoes.find(secao => secao.chave === 'das-armas')).toMatchObject({
      chavePai: 'dos-exames',
      repetirPara: 'armas',
    });
  });

  it('gera checksum estável para artefatos temporários de imagem', () => {
    const base = structuredClone(laudoPadraoB602V1);
    const comImagem = structuredClone(laudoPadraoB602V1);
    comImagem.secoes[2].conteudo += '<table><tbody><tr><td><figure data-dummy="true" data-image-id="aleatorio"><img src="x"></figure></td></tr></tbody></table>';

    expect(calcularChecksumTemplateIntegrado(comImagem)).toBe(calcularChecksumTemplateIntegrado(base));
  });

  it('rejeita chaves de seção duplicadas', () => {
    const invalido = structuredClone(laudoPadraoB602V1);
    invalido.secoes[1].chave = invalido.secoes[0].chave;

    expect(() => validarTemplateIntegrado(invalido)).toThrow('Chave de seção inválida');
  });
});
