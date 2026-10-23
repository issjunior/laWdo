import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB601V1 } from './laudo-padrao-b601.v1.js';

export const laudoPadraoB601V2: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB601V1,
  versao: 2,
  secoes: laudoPadraoB601V1.secoes.map(secao => {
    if (secao.chave === 'consideracoes-finais') {
      return { ...secao, conteudo: secao.conteudo.replace('Lei no', 'Lei nº') };
    }
    if (secao.chave === 'encerramento') {
      return { ...secao, conteudo: secao.conteudo.replace('Instrução Normativa no', 'Instrução Normativa nº') };
    }
    return { ...secao };
  }),
};
