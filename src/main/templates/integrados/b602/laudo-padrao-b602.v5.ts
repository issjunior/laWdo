import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { criarTabelaDummies } from './laudo-padrao-b602.v1.js';
import { laudoPadraoB602V4 } from './laudo-padrao-b602.v4.js';

const conteudoDosEstojos = `<p style="text-align: justify; text-indent: 35.43pt;">Trata-se de <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_total_estojos}}">{{b602_total_estojos}}</span> estojos provenientes de munição própria para uso em armas de fogo, integralmente descritos no quadro a seguir:</p>
<p><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_estojos}}">{{b602_tabela_estojos}}</span></p>
${criarTabelaDummies('dummy-b602-estojos')}
<p style="text-align: justify; text-indent: 35.43pt;">Os estojos percutidos e deflagrados foram retornados à Central de Custódia, devidamente embalados, garantindo a integridade das marcas de percussão para futuros exames de comparação microbalística, prestando ainda como prova material de disparo de arma de fogo. Diante da sua deflagração, encontram-se ineficientes ao fim a que se destinam.</p>`;

export const laudoPadraoB602V5: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V4,
  versao: 5,
  secoes: laudoPadraoB602V4.secoes.map(secao => (
    secao.chave === 'dos-estojos'
      ? { ...secao, conteudo: conteudoDosEstojos }
      : { ...secao }
  )),
};
