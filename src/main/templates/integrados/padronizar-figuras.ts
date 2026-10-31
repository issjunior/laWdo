import { DomUtils, parseDocument } from 'htmlparser2';
import { URL_FIGURA_DUMMY } from '../../../shared/figura/html.js';
import type { DefinicaoTemplateIntegrado } from './tipos.js';

export function padronizarFigurasTemplate(template: DefinicaoTemplateIntegrado, versao: number): DefinicaoTemplateIntegrado {
  return {
    ...template,
    versao,
    secoes: template.secoes.map(secao => {
      if (!secao.conteudo.includes('data-dummy="true"')) return { ...secao };
      const documento = parseDocument(secao.conteudo);
      const figuras = DomUtils.findAll(elemento => elemento.name === 'figure' && elemento.attribs['data-dummy'] === 'true', documento.children);
      for (const figura of figuras) {
        const imagem = DomUtils.findOne(elemento => elemento.name === 'img', figura.children);
        if (imagem) imagem.attribs.src = URL_FIGURA_DUMMY;
        let ancestral = figura.parent;
        while (ancestral && !(DomUtils.isTag(ancestral) && ancestral.name === 'table')) ancestral = ancestral.parent;
        if (!ancestral || !DomUtils.isTag(ancestral)) continue;
        ancestral.attribs.border = '0';
        for (const elemento of [ancestral, ...DomUtils.findAll(no => no.name === 'td' || no.name === 'th', ancestral.children)]) {
          const estilo = (elemento.attribs.style ?? '').split(';').filter(regra => !/^\s*border(?:-(?:top|right|bottom|left|width|style|color)(?:-(?:width|style|color))?)?\s*:/i.test(regra));
          elemento.attribs.style = [...estilo.filter(regra => regra.trim()), 'border:0'].join(';');
        }
      }
      return { ...secao, conteudo: DomUtils.getInnerHTML(documento) };
    }),
  };
}
