import { laudoPadraoB601V2 } from './laudo-padrao-b601.v2.js';
import type { DefinicaoTemplateIntegrado } from '../tipos.js';
import { URL_FIGURA_DUMMY } from '../../../../shared/figura/html.js';

const prepararTabelas = (html: string): string => html.replace(/<pre\b[^>]*>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>/g, '<p>$1</p>');

export const laudoPadraoB601LocalNecropsiaV1: DefinicaoTemplateIntegrado = {
  ...laudoPadraoB601V2,
  chave: 'laudo-padrao-b601-local-necropsia',
  versao: 1,
  nome: 'Laudo Padrão B-601 — Local com Necropsia',
  descricao: 'Constatação de vestígios balísticos coletados em exames de local e necropsia.',
  secoes: laudoPadraoB601V2.secoes.map(secao => {
    if (secao.chave === 'preambulo') {
      const inicioSolicitacao = secao.conteudo.indexOf('&nbsp;a fim de ser atendida');
      const fimParagrafo = secao.conteudo.indexOf('</p>', inicioSolicitacao);
      return { ...secao, conteudo: secao.conteudo.slice(0, inicioSolicitacao)
        + ' em complemento aos exames de local de morte e/ou necropsia em que tais vestígios foram coletados.</span></span>'
        + secao.conteudo.slice(fimParagrafo) };
    }
    if (secao.chave === 'objetivo') return { ...secao, conteudo: prepararTabelas(secao.conteudo) };
    if (secao.chave === 'material-apresentado') return { ...secao,
      conteudo: prepararTabelas(secao.conteudo.replaceAll('b601_tabela_material_enc', 'b601_tabela_material_coleta'))
        .replace(/src="data:image\/svg\+xml;base64,[^"]*"/g, `src="${URL_FIGURA_DUMMY}"`)
        .replace('<tbody>', '<thead><tr><th colspan="2">TABELA 3 – TOMADAS FOTOGRÁFICAS DAS EMBALAGENS RECEBIDAS</th></tr></thead><tbody>') };
    if (secao.chave === 'dos-projeteis' || secao.chave === 'dos-estojos') return { ...secao,
      conteudo: '<div data-b601-modelo-coleta="true"></div>' };
    if (secao.chave === 'consideracoes-finais') return { ...secao,
      conteudo: secao.conteudo + '\n<div data-b601-sinab="opcional"><p>&nbsp;</p></div>' };
    return { ...secao };
  }),
};
