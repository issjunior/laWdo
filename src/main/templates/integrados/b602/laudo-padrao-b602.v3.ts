import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB602V2 } from './laudo-padrao-b602.v2.js';

const conteudoDosExames = `<div class="cond-bloco" data-cond-bloco="b602_cartuchos_toggle">
<h3>DOS CARTUCHOS</h3>
<p style="text-align: justify; text-indent: 35.43pt;">Trata-se de <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_total_cartuchos}}">{{b602_total_cartuchos}}</span> cartuchos, próprios para uso em armas de fogo, integralmente descritos no quadro a seguir:</p>
<p><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_cartuchos}}">{{b602_tabela_cartuchos}}</span></p>
</div>
<div class="cond-bloco" data-cond-bloco="b602_estojos_toggle">
<h3>DOS ESTOJOS</h3>
<p><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_estojos}}">{{b602_tabela_estojos}}</span></p>
</div>`;

export const laudoPadraoB602V3: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V2,
  versao: 3,
  secoes: laudoPadraoB602V2.secoes.map(secao => (
    secao.chave === 'dos-exames'
      ? { ...secao, conteudo: conteudoDosExames }
      : { ...secao }
  )),
};
