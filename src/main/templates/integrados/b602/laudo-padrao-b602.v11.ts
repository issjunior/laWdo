import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { criarTabelaDummies } from './laudo-padrao-b602.v1.js';
import { laudoPadraoB602V10 } from './laudo-padrao-b602.v10.js';

const conteudoDosCartuchos = `<p style="text-align: justify; text-indent: 35.43pt;">Trata-se de <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_total_cartuchos_extenso}}">{{b602_total_cartuchos_extenso}}</span> <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_cartuchos_descricao}}">{{b602_cartuchos_descricao}}</span></p>
<p><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_cartuchos}}">{{b602_tabela_cartuchos}}</span></p>
${criarTabelaDummies('dummy-b602-cartuchos')}`;

export const laudoPadraoB602V11: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V10,
  versao: 11,
  secoes: laudoPadraoB602V10.secoes.map(secao => secao.chave === 'dos-cartuchos'
    ? { ...secao, conteudo: conteudoDosCartuchos }
    : { ...secao }),
};
