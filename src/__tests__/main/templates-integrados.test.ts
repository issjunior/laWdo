import { describe, expect, it } from 'vitest';
import { laudoPadraoB602V1 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v1';
import { laudoPadraoB602V4 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v4';
import { laudoPadraoB602V5 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v5';
import { laudoPadraoB602V6 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v6';
import { laudoPadraoB602V7 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v7';
import { laudoPadraoB602V8 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v8';
import { laudoPadraoB602V9 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v9';
import { laudoPadraoB602V10 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v10';
import { laudoPadraoB601V1 } from '../../main/templates/integrados/b601/laudo-padrao-b601.v1';
import { laudoPadraoB601V2 } from '../../main/templates/integrados/b601/laudo-padrao-b601.v2';
import { catalogoTemplatesIntegrados } from '../../main/templates/integrados/catalogo';
import { calcularChecksumTemplateIntegrado } from '../../main/templates/integrados/serializar-template-integrado';
import { validarTemplateIntegrado } from '../../main/templates/integrados/validar-template-integrado';

describe('catálogo de templates integrados', () => {
  it.each([
    { anterior: laudoPadraoB601V1, atual: laudoPadraoB601V2, versao: 2 },
    { anterior: laudoPadraoB602V9, atual: laudoPadraoB602V10, versao: 10 },
  ])('publica $atual.chave v$versao corrigindo apenas as abreviações de número', ({ anterior, atual, versao }) => {
    expect(() => validarTemplateIntegrado(atual)).not.toThrow();
    expect(atual.versao).toBe(versao);
    expect(catalogoTemplatesIntegrados.filter(template => template.chave === atual.chave)).toEqual([atual]);
    expect(anterior.secoes.find(secao => secao.chave === 'consideracoes-finais')?.conteudo).toContain('Lei no 13.964/2019');
    expect(anterior.secoes.find(secao => secao.chave === 'encerramento')?.conteudo).toContain('Instrução Normativa no 001/2020-PCP');
    expect(atual.secoes.find(secao => secao.chave === 'consideracoes-finais')?.conteudo).toContain('Lei nº 13.964/2019');
    expect(atual.secoes.find(secao => secao.chave === 'encerramento')?.conteudo).toContain('Instrução Normativa nº 001/2020-PCP');
    const secoesRevertidas = atual.secoes.map(secao => {
      if (secao.chave === 'consideracoes-finais') {
        return { ...secao, conteudo: secao.conteudo.replace('Lei nº', 'Lei no') };
      }
      if (secao.chave === 'encerramento') {
        return { ...secao, conteudo: secao.conteudo.replace('Instrução Normativa nº', 'Instrução Normativa no') };
      }
      return secao;
    });
    expect({ ...atual, versao: anterior.versao, secoes: secoesRevertidas }).toEqual(anterior);
  });

  it('preserva a versão 9 com concordância calculada somente na seção de estojos', () => {
    expect(() => validarTemplateIntegrado(laudoPadraoB602V9)).not.toThrow();
    expect(laudoPadraoB602V9.versao).toBe(9);
    expect(laudoPadraoB602V9.secoes.filter(secao => secao.chave !== 'dos-estojos'))
      .toEqual(laudoPadraoB602V8.secoes.filter(secao => secao.chave !== 'dos-estojos'));
    const conteudo = laudoPadraoB602V9.secoes.find(secao => secao.chave === 'dos-estojos')?.conteudo || '';
    expect(conteudo).toContain('{{b602_total_estojos_extenso}}');
    expect(conteudo).toContain('{{b602_estojos_descricao}}');
    expect(conteudo).toContain('{{b602_estojos_conclusao}}');
    expect(conteudo).toContain('{{b602_tabela_estojos}}');
    expect(conteudo.match(/data-image-id="dummy-b602-estojos-[12]"/g)).toHaveLength(2);
    expect(laudoPadraoB602V8.secoes.find(secao => secao.chave === 'dos-estojos')?.conteudo).toContain('Os estojos percutidos e deflagrados foram retornados');
  });

  it('publica a versão 8 alterando somente o total de estojos para o novo placeholder', () => {
    expect(() => validarTemplateIntegrado(laudoPadraoB602V8)).not.toThrow();
    expect(laudoPadraoB602V8.versao).toBe(8);
    expect(laudoPadraoB602V8.secoes).toEqual(laudoPadraoB602V7.secoes.map(secao => secao.chave === 'dos-estojos'
      ? { ...secao, conteudo: secao.conteudo.replaceAll('{{b602_total_estojos}}', '{{b602_total_estojos_extenso}}') }
      : secao));
    expect(laudoPadraoB602V7.secoes.find(secao => secao.chave === 'dos-estojos')?.conteudo).toContain('{{b602_total_estojos}}');
  });

  it('preserva a versão 7 com o título do preâmbulo oculto e fora da contagem', () => {
    expect(() => validarTemplateIntegrado(laudoPadraoB602V7)).not.toThrow();
    expect(laudoPadraoB602V7.versao).toBe(7);
    expect(laudoPadraoB602V7.secoes[0]).toMatchObject({ chave: 'preambulo', ocultarTitulo: true, contarNaNumeracao: false });
    expect(laudoPadraoB602V7.secoes.map(secao => secao.conteudo)).toEqual(laudoPadraoB602V6.secoes.map(secao => secao.conteudo));
    expect(laudoPadraoB602V7.secoes.slice(1)).toEqual(laudoPadraoB602V6.secoes.slice(1));
    expect(laudoPadraoB602V6.secoes[0].ocultarTitulo).toBeUndefined();
  });

  it('considera as preferências no checksum sem mudar o hash das versões anteriores', () => {
    const explicito = structuredClone(laudoPadraoB602V6);
    explicito.secoes[0].ocultarTitulo = false;
    explicito.secoes[0].contarNaNumeracao = true;
    expect(calcularChecksumTemplateIntegrado(explicito)).toBe(calcularChecksumTemplateIntegrado(laudoPadraoB602V6));
    explicito.secoes[0].ocultarTitulo = true;
    expect(calcularChecksumTemplateIntegrado(explicito)).not.toBe(calcularChecksumTemplateIntegrado(laudoPadraoB602V6));
    const contando = calcularChecksumTemplateIntegrado(explicito);
    explicito.secoes[0].contarNaNumeracao = false;
    expect(calcularChecksumTemplateIntegrado(explicito)).not.toBe(contando);
  });

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

  it('parametriza as expressões do perito na versão 6', () => {
    expect(() => validarTemplateIntegrado(laudoPadraoB602V6)).not.toThrow();
    expect(laudoPadraoB602V6.versao).toBe(6);
    const conteudo = laudoPadraoB602V6.secoes.map(secao => secao.conteudo).join(' ');
    for (const chave of ['perito_designado', 'perito_artigo', 'perito_cargo', 'perito_titulo', 'perito_pelo', 'perito_qual']) {
      expect(conteudo).toContain(`{{${chave}}}`);
    }
    expect(conteudo).not.toContain('o Perito');
    expect(conteudo).not.toContain('pelo Perito');
  });

  it('rejeita chaves de seção duplicadas', () => {
    const invalido = structuredClone(laudoPadraoB602V1);
    invalido.secoes[1].chave = invalido.secoes[0].chave;

    expect(() => validarTemplateIntegrado(invalido)).toThrow('Chave de seção inválida');
  });
});
