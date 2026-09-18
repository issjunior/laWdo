import { describe, expect, it } from 'vitest';
import { laudoPadraoB602V1 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v1';
import { laudoPadraoB602V4 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v4';
import { laudoPadraoB602V5 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v5';
import { calcularChecksumTemplateIntegrado } from '../../main/templates/integrados/serializar-template-integrado';
import { validarTemplateIntegrado } from '../../main/templates/integrados/validar-template-integrado';

describe('catálogo de templates integrados', () => {
  it('mantém o B602 estruturado, com seção repetível por arma', () => {
    expect(() => validarTemplateIntegrado(laudoPadraoB602V1)).not.toThrow();
    expect(laudoPadraoB602V1.chave).toBe('laudo-padrao-b602');
    expect(laudoPadraoB602V1.versao).toBe(1);
    expect(laudoPadraoB602V1.secoes).toHaveLength(8);
    expect(laudoPadraoB602V1.secoes.find(secao => secao.chave === 'das-armas')).toMatchObject({
      chavePai: 'dos-exames',
      repetirPara: 'armas',
    });
    expect(laudoPadraoB602V1.secoes.find(secao => secao.chave === 'material-apresentado')?.conteudo.match(/data-dummy="true"/g))
      .toHaveLength(2);
    expect(laudoPadraoB602V1.secoes.find(secao => secao.chave === 'das-armas')?.conteudo.match(/data-dummy="true"/g))
      .toHaveLength(2);
    expect(laudoPadraoB602V1.secoes.find(secao => secao.chave === 'das-armas')?.conteudo)
      .toMatch(/b602_arma_N_coleta_padroes_v2[\s\S]*<\/div>\n<table[\s\S]*dummy-b602-arma-1/);
    expect(laudoPadraoB602V1.secoes.find(secao => secao.chave === 'dos-exames')?.conteudo)
      .toContain('<h3>DOS CARTUCHOS</h3>');
  });

  it('gera checksum estável para artefatos temporários de imagem', () => {
    const base = structuredClone(laudoPadraoB602V1);
    const comImagem = structuredClone(laudoPadraoB602V1);
    comImagem.secoes[2].conteudo += '<table><tbody><tr><td><figure data-dummy="true" data-image-id="aleatorio"><img src="x"></figure></td></tr></tbody></table>';

    expect(calcularChecksumTemplateIntegrado(comImagem)).toBe(calcularChecksumTemplateIntegrado(base));
  });

  it('estrutura cartuchos, estojos e armas como subseções do B-602 atual', () => {
    const conteudoCartuchos = laudoPadraoB602V4.secoes.find(secao => secao.chave === 'dos-cartuchos')?.conteudo || '';

    expect(() => validarTemplateIntegrado(laudoPadraoB602V4)).not.toThrow();
    expect(laudoPadraoB602V4.versao).toBe(4);
    expect(laudoPadraoB602V4.secoes.find(secao => secao.chave === 'dos-cartuchos')).toMatchObject({
      chavePai: 'dos-exames',
      ordem: 4,
    });
    expect(laudoPadraoB602V4.secoes.find(secao => secao.chave === 'dos-estojos')).toMatchObject({
      chavePai: 'dos-exames',
      ordem: 5,
    });
    expect(laudoPadraoB602V4.secoes.find(secao => secao.chave === 'das-armas')).toMatchObject({
      chavePai: 'dos-exames',
      ordem: 6,
    });
    expect(conteudoCartuchos).toContain('Trata-se de');
    expect(conteudoCartuchos).toContain('{{b602_total_cartuchos}}');
    expect(conteudoCartuchos).toContain('text-align: justify; text-indent: 35.43pt;');
  });

  it('inclui total, figuras dummy e texto de custódia na subseção de estojos atual', () => {
    const conteudoEstojos = laudoPadraoB602V5.secoes.find(secao => secao.chave === 'dos-estojos')?.conteudo || '';

    expect(() => validarTemplateIntegrado(laudoPadraoB602V5)).not.toThrow();
    expect(laudoPadraoB602V5.versao).toBe(5);
    expect(conteudoEstojos).toContain('{{b602_total_estojos}}');
    expect(conteudoEstojos).toContain('text-align: justify; text-indent: 35.43pt;');
    expect(conteudoEstojos.match(/data-image-id="dummy-b602-estojos-[12]"/g)).toHaveLength(2);
    expect(conteudoEstojos).toContain('Os estojos percutidos e deflagrados foram retornados à Central de Custódia');
  });

  it('rejeita chaves de seção duplicadas', () => {
    const invalido = structuredClone(laudoPadraoB602V1);
    invalido.secoes[1].chave = invalido.secoes[0].chave;

    expect(() => validarTemplateIntegrado(invalido)).toThrow('Chave de seção inválida');
  });
});
