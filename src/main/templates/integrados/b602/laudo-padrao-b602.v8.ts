import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB602V7 } from './laudo-padrao-b602.v7.js';

export const laudoPadraoB602V8: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V7,
  versao: 8,
  secoes: laudoPadraoB602V7.secoes.map(secao => secao.chave === 'dos-estojos'
    ? { ...secao, conteudo: secao.conteudo.replaceAll('{{b602_total_estojos}}', '{{b602_total_estojos_extenso}}') }
    : { ...secao }),
};
