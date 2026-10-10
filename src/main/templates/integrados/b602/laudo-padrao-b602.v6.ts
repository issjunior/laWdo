import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB602V5 } from './laudo-padrao-b602.v5.js';

function marcador(chave: string): string {
  return `<span class="placeholder-tag" contenteditable="false" data-placeholder="{{${chave}}}">{{${chave}}}</span>`;
}

export const laudoPadraoB602V6: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V5,
  versao: 6,
  secoes: laudoPadraoB602V5.secoes.map(secao => {
    let conteudo = secao.conteudo;
    if (secao.chave === 'preambulo') {
      conteudo = conteudo
        .replace('foi designado o ', `foi ${marcador('perito_designado')} ${marcador('perito_artigo')} `)
        .replace('o Perito procedeu', `${marcador('perito_artigo')} ${marcador('perito_titulo')} procedeu`);
    }
    if (secao.chave === 'das-armas') {
      conteudo = conteudo.replace('o Perito submeteu-a', `${marcador('perito_artigo')} ${marcador('perito_titulo')} submeteu-a`);
    }
    if (secao.chave === 'encerramento') {
      conteudo = conteudo
        .replace('pelo Perito que realizou o exame, o qual o&nbsp;subscreve', `${marcador('perito_pelo')} ${marcador('perito_titulo')} que realizou o exame, ${marcador('perito_qual')} o&nbsp;subscreve`)
        .replace('tem o&nbsp;Perito a prestar', `tem ${marcador('perito_artigo')}&nbsp;${marcador('perito_titulo')} a prestar`);
    }
    return { ...secao, conteudo };
  }),
};
