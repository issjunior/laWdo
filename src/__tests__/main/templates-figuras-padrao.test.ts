import { describe, expect, it } from 'vitest';
import { URL_FIGURA_DUMMY } from '../../shared/figura/html';
import { catalogoTemplatesIntegrados } from '../../main/templates/integrados/catalogo';
import { laudoPadraoB601V2 } from '../../main/templates/integrados/b601/laudo-padrao-b601.v2';
import { laudoPadraoB601LocalNecropsiaV3 } from '../../main/templates/integrados/b601/laudo-padrao-b601-local-necropsia.v3';
import { laudoPadraoB602V11 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v11';
import { padronizarFigurasTemplate } from '../../main/templates/integrados/padronizar-figuras';
import { validarTemplateIntegrado } from '../../main/templates/integrados/validar-template-integrado';
import { ESTILOS_TABELAS_PLACEHOLDER_PDF } from '../../main/services/pdf-tabelas';

describe('padrão das figuras nos novos templates', () => {
  it('codifica cores válidas e o desenho de referência B-602', () => {
    const svg = atob(URL_FIGURA_DUMMY.split(',')[1]);
    expect(svg).toContain('viewBox="0 0 600 400"');
    expect(svg).toContain('fill="#3a3a3a"');
    expect(svg).toContain('<circle');
    expect(svg).toContain('<polyline');
    expect(svg).toContain('INSERIR IMAGEM');
    expect(svg).toContain('Clique para substituir');
    expect(svg).not.toContain('%23');
  });

  it.each([
    { anterior: laudoPadraoB601V2, versao: 3 },
    { anterior: laudoPadraoB601LocalNecropsiaV3, versao: 4 },
    { anterior: laudoPadraoB602V11, versao: 12 },
  ])('publica $anterior.chave v$versao preservando a versão anterior', ({ anterior, versao }) => {
    const original = JSON.stringify(anterior);
    const atual = catalogoTemplatesIntegrados.find(template => template.chave === anterior.chave)!;
    expect(atual.versao).toBe(versao);
    expect(() => validarTemplateIntegrado(atual)).not.toThrow();
    expect(atual).toEqual(padronizarFigurasTemplate(anterior, versao));
    let quantidade = 0;
    atual.secoes.forEach((secao, indice) => {
      const previa = new DOMParser().parseFromString(anterior.secoes[indice].conteudo, 'text/html');
      const documento = new DOMParser().parseFromString(secao.conteudo, 'text/html');
      const figuras = documento.querySelectorAll('figure[data-dummy="true"]');
      quantidade += figuras.length;
      expect(figuras.length).toBe(previa.querySelectorAll('figure[data-dummy="true"]').length);
      expect(documento.body.textContent).toBe(previa.body.textContent);
      figuras.forEach(figura => {
        expect(figura.querySelector('img')?.getAttribute('src')).toBe(URL_FIGURA_DUMMY);
        expect(figura.querySelector<HTMLImageElement>('img')?.style.borderWidth).toBe('1px');
        const tabela = figura.closest('table')!;
        expect(tabela.getAttribute('border')).toBe('0');
        expect(tabela.style.borderWidth).toBe('0px');
        tabela.querySelectorAll<HTMLElement>('td, th').forEach(celula => expect(celula.style.borderWidth).toBe('0px'));
      });
      previa.querySelectorAll('table').forEach((tabela, indiceTabela) => {
        if (!tabela.querySelector('[data-dummy="true"]')) {
          expect(documento.querySelectorAll('table')[indiceTabela].outerHTML).toBe(tabela.outerHTML);
        }
      });
    });
    expect(quantidade).toBeGreaterThan(0);
    expect(JSON.stringify(anterior)).toBe(original);
  });

  it('respeita borda zero na saída e mantém bordas explícitas por célula', () => {
    const estilo = document.createElement('style');
    estilo.textContent = `table td, table th { border:1px solid #ddd } ${ESTILOS_TABELAS_PLACEHOLDER_PDF}`;
    document.head.append(estilo);
    document.body.innerHTML = '<table border="0"><thead><tr><th>Título</th></tr></thead><tbody><tr><td>Foto</td><td style="border:2px solid red">Borda escolhida</td></tr></tbody></table><table><tbody><tr><td>Dados</td></tr></tbody></table>';
    const celulas = document.querySelectorAll('th, td');
    try {
      expect(getComputedStyle(celulas[0]).borderTopWidth).toBe('0px');
      expect(getComputedStyle(celulas[1]).borderTopWidth).toBe('0px');
      expect(getComputedStyle(celulas[2]).borderTopWidth).toBe('2px');
      expect(getComputedStyle(celulas[3]).borderTopWidth).toBe('1px');
    } finally {
      estilo.remove();
      document.body.innerHTML = '';
    }
  });
});
