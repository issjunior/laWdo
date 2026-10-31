import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { laudoPadraoB601LocalNecropsiaV2 } from './laudo-padrao-b601-local-necropsia.v2.js';

export const laudoPadraoB601LocalNecropsiaV3: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB601LocalNecropsiaV2,
  versao: 3,
  nome: 'Laudo Padrão B-601 - Local com Necropsia',
  secoes: laudoPadraoB601LocalNecropsiaV2.secoes.map(secao => secao.chave === 'preambulo'
    ? { ...secao, conteudo: secao.conteudo.replace(/^(?:<p\b[^>]*>[\s\S]*?<\/p>\s*){2}/, '') }
    : { ...secao }),
};
