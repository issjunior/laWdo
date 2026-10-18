export function separarComplementoB601(html: string): { descricao: string; complemento: string } {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const complementos = Array.from(documento.body.querySelectorAll<HTMLElement>('[data-b601-complemento]'))
    .filter(elemento => !elemento.parentElement?.closest('[data-b601-complemento]'));
  const complemento = complementos.map(elemento => elemento.innerHTML).join('\n');
  complementos.forEach(elemento => elemento.remove());
  return { descricao: documento.body.innerHTML, complemento };
}

export function juntarComplementoB601(descricao: string, complemento: string): string {
  return `${descricao}<div data-b601-complemento="true">${complemento}</div>`;
}

import { ehAgrupamentoB601, gerarPreviaDescricaoB601 } from '@shared/utils/b601-descricao-agrupada';


export function montarEdicaoComplementoB601(conteudo: string, repeticao: string): string {
  const partes = separarComplementoB601(conteudo);
  const automatica = ehAgrupamentoB601(repeticao);
  const descricao = automatica ? gerarPreviaDescricaoB601(repeticao.endsWith(':105') ? '105' : '101') : partes.descricao;
  return `<div data-b601-descricao-template="true"${automatica ? ' contenteditable="false"' : ''}>${descricao || '<p>&nbsp;</p>'}</div>`
    + '<p contenteditable="false" data-b601-rotulo-complemento="true"><strong>Conteúdo após a descrição</strong></p>'
    + `<div data-b601-complemento-template="true">${partes.complemento || '<p>&nbsp;</p>'}</div>`;
}

export function lerEdicaoComplementoB601(elemento: Element, original: string, repeticao: string): string {
  const descricao = ehAgrupamentoB601(repeticao) ? separarComplementoB601(original).descricao
    : elemento.querySelector(':scope > [data-b601-descricao-template]')?.innerHTML || '';
  const complemento = elemento.querySelector(':scope > [data-b601-complemento-template]')?.innerHTML || '';
  return juntarComplementoB601(descricao, complemento);
}
