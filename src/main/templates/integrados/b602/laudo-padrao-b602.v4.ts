import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB602V3 } from './laudo-padrao-b602.v3.js';

const conteudoDosCartuchos = `<p style="text-align: justify; text-indent: 35.43pt;">Trata-se de <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_total_cartuchos}}">{{b602_total_cartuchos}}</span> cartuchos, próprios para uso em armas de fogo, integralmente descritos no quadro a seguir:</p>
<p><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_cartuchos}}">{{b602_tabela_cartuchos}}</span></p>`;

const conteudoDosEstojos = `<p><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_estojos}}">{{b602_tabela_estojos}}</span></p>`;

export const laudoPadraoB602V4: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V3,
  versao: 4,
  secoes: [
    ...laudoPadraoB602V3.secoes.flatMap(secao => {
      if (secao.chave === 'dos-exames') {
        return [
          { ...secao, conteudo: '<p></p>' },
          {
            chave: 'dos-cartuchos', chavePai: 'dos-exames', nome: 'DOS CARTUCHOS', ordem: 4,
            conteudo: conteudoDosCartuchos,
          },
          {
            chave: 'dos-estojos', chavePai: 'dos-exames', nome: 'DOS ESTOJOS', ordem: 5,
            conteudo: conteudoDosEstojos,
          },
        ];
      }

      const ordemPorChave: Record<string, number> = {
        'das-armas': 6,
        conclusao: 7,
        'consideracoes-finais': 8,
        encerramento: 9,
      };

      return [{ ...secao, ordem: ordemPorChave[secao.chave] ?? secao.ordem }];
    }),
  ],
};
