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

export function gerarPreviaColetaTemplateB601(conteudo: string, repeticao: string): string {
  const documento = new DOMParser().parseFromString(conteudo, 'text/html');
  const fotos = new Map(Array.from(documento.querySelectorAll('[data-b601-fotos-modelo]'))
    .map(elemento => [elemento.getAttribute('data-b601-fotos-modelo') || '', elemento.innerHTML]));
  return gerarPreviaDescricaoB601(repeticao.endsWith(':105') ? '105' : '101', conteudo.includes('data-b601-modelo-coleta="true"'), fotos);
}

export function obterBlocosColetaTemplateB601(conteudo: string, repeticao: string): Array<{ origem: string; descricao: string; fotos: string }> {
  if (!ehAgrupamentoB601(repeticao) || !conteudo.includes('data-b601-modelo-coleta="true"')) return [];
  const documento = new DOMParser().parseFromString(gerarPreviaColetaTemplateB601(conteudo, repeticao), 'text/html');
  const blocos: Array<{ origem: string; descricao: string; fotos: string }> = [];
  let descricao = '';
  for (const elemento of Array.from(documento.querySelector('[data-b601-grupo]')?.children || [])) {
    const origem = elemento.getAttribute('data-b601-fotos-origem');
    if (origem !== null) {
      blocos.push({ origem, descricao, fotos: elemento.innerHTML });
      descricao = '';
    } else descricao += elemento.outerHTML;
  }
  return blocos;
}

export function atualizarFotosColetaTemplateB601(conteudo: string, origem: string, fotos: string): string {
  const documento = new DOMParser().parseFromString(conteudo, 'text/html');
  const modelo = documento.querySelector('[data-b601-modelo-coleta="true"]');
  if (!modelo) return conteudo;
  const existente = Array.from(modelo.querySelectorAll('[data-b601-fotos-modelo]'))
    .find(elemento => elemento.getAttribute('data-b601-fotos-modelo') === origem);
  const elemento = existente || documento.createElement('div');
  elemento.setAttribute('data-b601-fotos-modelo', origem);
  elemento.innerHTML = fotos;
  if (!existente) modelo.appendChild(elemento);
  return documento.body.innerHTML;
}

export function montarEdicaoComplementoB601(conteudo: string, repeticao: string): string {
  const partes = separarComplementoB601(conteudo);
  const automatica = ehAgrupamentoB601(repeticao);
  const blocos = obterBlocosColetaTemplateB601(conteudo, repeticao);
  const descricao = automatica ? gerarPreviaColetaTemplateB601(conteudo, repeticao) : partes.descricao;
  if (blocos.length) {
    const documento = new DOMParser().parseFromString(descricao, 'text/html');
    for (const elemento of Array.from(documento.querySelector('[data-b601-grupo]')?.children || [])) {
      const origem = elemento.getAttribute('data-b601-fotos-origem');
      if (origem !== null) {
        elemento.removeAttribute('data-b601-complemento');
        elemento.setAttribute('data-b601-fotos-edicao', origem);
      } else {
        elemento.setAttribute('data-b601-descricao-template', 'true');
        elemento.setAttribute('contenteditable', 'false');
      }
    }
    return documento.body.innerHTML
      + '<p contenteditable="false" data-b601-rotulo-complemento="true"><strong>Conteúdo após a descrição</strong></p>'
      + `<div data-b601-complemento-template="true">${partes.complemento || '<p>&nbsp;</p>'}</div>`;
  }
  return `<div data-b601-descricao-template="true"${automatica ? ' contenteditable="false"' : ''}>${descricao || '<p>&nbsp;</p>'}</div>`
    + '<p contenteditable="false" data-b601-rotulo-complemento="true"><strong>Conteúdo após a descrição</strong></p>'
    + `<div data-b601-complemento-template="true">${partes.complemento || '<p>&nbsp;</p>'}</div>`;
}

export function lerEdicaoComplementoB601(elemento: Element, original: string, repeticao: string): string {
  let descricao = ehAgrupamentoB601(repeticao) ? separarComplementoB601(original).descricao
    : elemento.querySelector(':scope > [data-b601-descricao-template]')?.innerHTML || '';
  if (ehAgrupamentoB601(repeticao)) {
    for (const fotos of Array.from(elemento.querySelectorAll('[data-b601-fotos-edicao]'))) {
      descricao = atualizarFotosColetaTemplateB601(descricao, fotos.getAttribute('data-b601-fotos-edicao') || '', fotos.innerHTML);
    }
  }
  const complemento = elemento.querySelector(':scope > [data-b601-complemento-template]')?.innerHTML || '';
  return juntarComplementoB601(descricao, complemento);
}
