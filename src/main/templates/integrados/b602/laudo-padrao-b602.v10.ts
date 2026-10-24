import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB602V9 } from './laudo-padrao-b602.v9.js';

export const laudoPadraoB602V10: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V9,
  versao: 10,
  secoes: laudoPadraoB602V9.secoes.map(secao => {
    if (secao.chave === 'consideracoes-finais') {
      return { ...secao, conteudo: secao.conteudo.replace('Lei no', 'Lei nº') };
    }
    if (secao.chave === 'encerramento') {
      return { ...secao, conteudo: secao.conteudo.replace('Instrução Normativa no', 'Instrução Normativa nº') };
    }
    return { ...secao };
  }),
};
