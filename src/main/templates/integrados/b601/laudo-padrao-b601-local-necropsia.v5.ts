import { DomUtils, parseDocument } from 'htmlparser2';
import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB601LocalNecropsiaV4 } from './laudo-padrao-b601-local-necropsia.v4.js';

export const laudoPadraoB601LocalNecropsiaV5: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB601LocalNecropsiaV4,
  versao: 5,
  secoes: laudoPadraoB601LocalNecropsiaV4.secoes.map(secao => {
    if (secao.chave !== 'material-apresentado') return { ...secao };
    const documento = parseDocument(secao.conteudo);
    const moldura = DomUtils.findOne(elemento => elemento.name === 'figure'
      && elemento.attribs['data-image-id'] === 'dummy-b601-local-necropsia-material-apresentado-1', documento.children);
    const filhos = moldura?.children.filter(filho => filho.type !== 'text' || Boolean(filho.data.trim())) ?? [];
    if (!moldura || moldura.attribs['data-dummy'] !== 'true'
      || filhos.length !== 1 || !DomUtils.isTag(filhos[0]) || filhos[0].name !== 'figure'
      || !filhos[0].children.some(filho => DomUtils.isTag(filho) && filho.name === 'img')
      || !filhos[0].children.some(filho => DomUtils.isTag(filho) && filho.name === 'figcaption')) {
      throw new Error('Moldura vazia da primeira figura não encontrada no template Local com Necropsia');
    }
    DomUtils.replaceElement(moldura, filhos[0]);
    return { ...secao, conteudo: DomUtils.getInnerHTML(documento) };
  }),
};
