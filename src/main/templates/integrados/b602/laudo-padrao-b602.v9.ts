import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB602V8 } from './laudo-padrao-b602.v8.js';
import { TEXTOS_ESTOJOS_B602 } from '../../../../shared/catalogos/b602-textos-estojos.catalogo.js';

function marcador(chave: string): string {
  return `<span class="placeholder-tag" contenteditable="false" data-placeholder="{{${chave}}}">{{${chave}}}</span>`;
}

export const laudoPadraoB602V9: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V8,
  versao: 9,
  secoes: laudoPadraoB602V8.secoes.map(secao => secao.chave === 'dos-estojos'
    ? { ...secao, conteudo: secao.conteudo
      .replace(TEXTOS_ESTOJOS_B602.plural.descricao, marcador('b602_estojos_descricao'))
      .replace(TEXTOS_ESTOJOS_B602.plural.conclusao, marcador('b602_estojos_conclusao')) }
    : { ...secao }),
};
