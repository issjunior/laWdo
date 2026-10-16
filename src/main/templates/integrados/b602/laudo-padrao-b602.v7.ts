import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB602V6 } from './laudo-padrao-b602.v6.js';

export const laudoPadraoB602V7: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB602V6,
  versao: 7,
  secoes: laudoPadraoB602V6.secoes.map(secao => secao.chave === 'preambulo'
    ? { ...secao, ocultarTitulo: true, contarNaNumeracao: false }
    : { ...secao }),
};
