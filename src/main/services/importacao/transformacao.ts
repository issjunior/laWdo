import { parseDocument, DomUtils } from 'htmlparser2';
import { randomUUID } from 'crypto';
import { criarHtmlFigura, URL_FIGURA_DUMMY } from '../../../shared/figura/html.js';
import type { FormatoImportacaoTemplate, ResultadoImportacaoTemplate } from '../../../shared/types/importacao-template.types.js';
import { aviso, blocosDeHtml, type DocumentoExtraido, type ElementoDocumento, type NoDocumento } from './estrutura.js';
import { sanitizarHtmlImportacao } from './sanitizacao.js';

function substituirHtml(elemento: ElementoDocumento, html: string): void {
  const novo = parseDocument(html).children[0];
  if (novo && DomUtils.isTag(novo)) {
    for (const campo of ['data-importacao-elemento', 'data-importacao-pagina']) if (elemento.attribs[campo]) novo.attribs[campo] = elemento.attribs[campo];
  }
  if (novo) DomUtils.replaceElement(elemento, novo);
}

function ancestral(elemento: NoDocumento, tag: string): ElementoDocumento | null {
  let no = elemento.parent;
  while (no) {
    if (DomUtils.isTag(no) && no.name === tag) return no;
    no = no.parent;
  }
  return null;
}

function unirPlaceholders(elemento: ElementoDocumento): void {
  const nos: Extract<NoDocumento, { type: 'text' }>[] = [];
  const coletar = (filhos: NoDocumento[]) => {
    for (const no of filhos) {
      if (['td', 'th'].includes(elemento.name) && DomUtils.isTag(no) && ['p', 'table', 'figure', 'ol', 'ul', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(no.name)) continue;
      if (no.type === 'text') nos.push(no);
      else if ('children' in no) coletar(no.children);
    }
  };
  coletar(elemento.children);
  const texto = nos.map(no => no.data).join('');
  const correspondencias = [...texto.matchAll(/\{\{[^{}]+\}\}/g)];
  if (correspondencias.length > 2000) throw new Error('Bloco excede o limite de 2000 placeholders');
  for (const correspondencia of correspondencias.reverse()) {
    let posicao = 0;
    const inicio = correspondencia.index;
    const fim = inicio + correspondencia[0].length;
    let inserido = false;
    for (const no of nos) {
      const proxima = posicao + no.data.length;
      if (posicao < fim && proxima > inicio) {
        no.data = no.data.slice(0, Math.max(0, inicio - posicao)) + (inserido ? '' : correspondencia[0]) + no.data.slice(Math.max(0, fim - posicao));
        inserido = true;
      }
      posicao = proxima;
    }
  }
}

export function transformarDocumento(extraido: DocumentoExtraido, nomeArquivo: string, formato: FormatoImportacaoTemplate): ResultadoImportacaoTemplate {
  const avisos = [...extraido.avisos];
  const resumo = { tabelas: 0, figuras: 0 };
  const transformados = extraido.blocos.map(bloco => {
    let legendaDeclarada = false;
    const documento = parseDocument(bloco.html);
    for (const elemento of DomUtils.findAll(no => ['p', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(no.name), documento.children)) unirPlaceholders(elemento);
    for (const figura of DomUtils.findAll(no => no.name === 'figure', documento.children)) {
      const id = figura.attribs['data-image-id'] || randomUUID();
      substituirHtml(figura, criarHtmlFigura(URL_FIGURA_DUMMY, id, 'XXX', true));
      resumo.figuras++;
    }
    const imagens = DomUtils.findAll(no => no.name === 'img', documento.children);
    for (const imagem of imagens) {
      if (ancestral(imagem, 'figure')) continue;
      substituirHtml(imagem, criarHtmlFigura(URL_FIGURA_DUMMY, randomUUID(), 'XXX', true));
      resumo.figuras++;
    }
    for (const tabela of DomUtils.findAll(no => no.name === 'table', documento.children).reverse()) {
      resumo.tabelas++;
      const id = tabela.attribs['data-importacao-elemento'] || randomUUID();
      tabela.attribs['data-importacao-elemento'] = id;
      const celulas = DomUtils.findAll(no => ['td', 'th'].includes(no.name), tabela.children)
        .filter(no => ancestral(no, 'table') === tabela);
      if (celulas.length > 20_000) throw new Error('Tabela excede o limite de 20000 células');
    }
    for (const legenda of DomUtils.findAll(no => no.attribs['data-importacao-legenda'] === 'true', documento.children)) {
      const anterior = legenda.prev;
      if (anterior && (DomUtils.findAll(no => no.name === 'figure', [anterior]).length > 0)) DomUtils.removeElement(legenda);
      else if (legenda.parent === documento) legendaDeclarada = true;
      else avisos.push(aviso('legenda_vinculo_incerto', 'limitacao', 'Algumas legendas foram preservadas porque seu vínculo com as figuras não pôde ser determinado.', bloco.id, bloco.pagina));
    }
    const html = sanitizarHtmlImportacao(DomUtils.getInnerHTML(documento));
    return { ...bloco, html, legendaDeclarada };
  });
  for (let indice = 1; indice < transformados.length; indice++) {
    const atual = transformados[indice];
    const anterior = transformados[indice - 1];
    if (atual.legendaDeclarada) {
      const contexto = parseDocument(anterior.html);
      const figuras = DomUtils.findAll(no => no.name === 'figure', contexto.children);
      for (const figura of figuras) DomUtils.removeElement(figura);
      if (figuras.length === 1 && !DomUtils.textContent(contexto).trim()) {
        atual.html = ''; continue;
      }
      avisos.push(aviso('legenda_vinculo_incerto', 'limitacao', 'Algumas legendas foram preservadas porque seu vínculo com as figuras não pôde ser determinado.', atual.id, atual.pagina));
    }
    if (/^\s*(Figura|Fig\.)\s*\d+/i.test(DomUtils.textContent(parseDocument(atual.html))) && anterior.html.includes('data-dummy="true"')) {
      avisos.push(aviso('legenda_vinculo_incerto', 'limitacao', 'Algumas legendas foram preservadas porque seu vínculo com as figuras não pôde ser determinado.', atual.id, atual.pagina));
    }
  }
  const temTitulos = transformados.some(bloco => bloco.tipo === 'titulo');
  const secoes: ResultadoImportacaoTemplate['secoes'] = [];
  let atual: ResultadoImportacaoTemplate['secoes'][number] | undefined;
  for (const bloco of transformados) {
    if (!bloco.html && bloco.tipo !== 'titulo') continue;
    if (bloco.tipo === 'titulo') {
      atual = { id: randomUUID(), nome: bloco.titulo || 'Seção', conteudo: '', incluir: true };
      secoes.push(atual);
    } else {
      if (!atual) {
        atual = { id: randomUUID(), nome: temTitulos ? 'INTRODUÇÃO' : 'Documento Completo', conteudo: '', incluir: true };
        secoes.push(atual);
      }
      atual.conteudo += bloco.html;
    }
    for (const pendencia of avisos.filter(item => item.elementoId === bloco.id && bloco.tipo === 'titulo')) {
      pendencia.secaoId = atual.id;
      pendencia.elementoId = undefined;
    }
  }
  if (!secoes.length) throw new Error('Nenhum conteúdo recuperável encontrado no documento');
  // Reparar a estrutura após introduzir figuras em parágrafos e normalizar IDs dos blocos para divisão.
  for (const secao of secoes) secao.conteudo = blocosDeHtml(secao.conteudo).map(bloco => bloco.html).join('');
  return { nomeArquivo, formato, secoes, avisos, resumo };
}
