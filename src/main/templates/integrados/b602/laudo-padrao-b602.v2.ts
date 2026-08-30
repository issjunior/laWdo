import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB602V1 } from './laudo-padrao-b602.v1.js';

const conteudoConsideracoesFinais = `<div class="cond-bloco" data-cond-bloco="b602_lacres_saida_toggle">
<p style="text-align: justify; text-indent: 35.43pt;">O material descrito neste documento, após examinado, foi devidamente&nbsp;identificado, embalado e lacrado com <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_resumo_lacres_saida}}">{{b602_resumo_lacres_saida}}</span>, conforme requerido pelos artigos&nbsp;158-A a 158-F do Código de Processo Penal (Lei no 13.964/2019), e encaminhado&nbsp;para a Central de Custódia da Polícia Científica do Paraná.</p>
</div>`;

export const laudoPadraoB602V2: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V1,
  versao: 2,
  secoes: laudoPadraoB602V1.secoes.map(secao => (
    secao.chave === 'consideracoes-finais'
      ? { ...secao, conteudo: conteudoConsideracoesFinais }
      : { ...secao }
  )),
};
