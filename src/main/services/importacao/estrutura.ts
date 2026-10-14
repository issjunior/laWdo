import { parseDocument, DomUtils } from 'htmlparser2';
import { randomUUID } from 'crypto';
import type { AvisoImportacaoTemplate } from '../../../shared/types/importacao-template.types.js';

export type NoDocumento = ReturnType<typeof parseDocument>['children'][number];
export type ElementoDocumento = ReturnType<typeof DomUtils.getElementsByTagName>[number];
export interface BlocoImportacao {
  id: string;
  tipo: 'titulo' | 'paragrafo' | 'lista' | 'tabela' | 'figura' | 'outro';
  html: string;
  titulo?: string;
  pagina?: number;
}
export interface DocumentoExtraido {
  blocos: BlocoImportacao[];
  avisos: AvisoImportacaoTemplate[];
}
export const escaparHtml = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function validarArvore(raiz: NoDocumento[]): void {
  const fila = raiz.map(no => ({ no, profundidade: 0 }));
  let total = 0;
  while (fila.length) {
    const item = fila.pop()!;
    if (++total > 100_000 || item.profundidade > 80) throw new Error('Documento excede o limite de complexidade');
    if ('children' in item.no) fila.push(...item.no.children.map(no => ({ no, profundidade: item.profundidade + 1 })));
  }
}

export function blocosDeHtml(html: string, pagina?: number): BlocoImportacao[] {
  if (html.length > 12 * 1024 * 1024) throw new Error('Conteúdo extraído excede o limite de 12 MB');
  const documento = parseDocument(html);
  validarArvore(documento.children);
  const blocos: BlocoImportacao[] = [];
  const visitar = (nos: NoDocumento[]) => {
    for (const no of nos) {
      if (DomUtils.isTag(no) && ['html', 'body', 'div', 'section'].includes(no.name)) {
        visitar(no.children);
        continue;
      }
      const texto = DomUtils.textContent(no).trim();
      const tag = DomUtils.isTag(no) ? no.name : '';
      if (!texto && !DomUtils.isTag(no)) continue;
      const titulo = /^h[1-6]$/.test(tag)
        || (tag === 'p' && texto.length <= 120 && /^(?:\d+[.)ºª\-–—]\s+\D|PRE[ÂA]MBULO$)/i.test(texto));
      const tipo = titulo ? 'titulo' : tag === 'table' ? 'tabela' : tag === 'figure' ? 'figura'
        : ['ol', 'ul'].includes(tag) ? 'lista' : tag === 'p' ? 'paragrafo' : 'outro';
      const id = DomUtils.isTag(no) && no.attribs['data-importacao-elemento'] || randomUUID();
      if (DomUtils.isTag(no)) no.attribs['data-importacao-elemento'] = id;
      blocos.push({ id, tipo, html: DomUtils.isTag(no) ? DomUtils.getOuterHTML(no) : `<p data-importacao-elemento="${id}">${escaparHtml(texto)}</p>`, titulo: titulo ? texto : undefined, pagina });
    }
  };
  visitar(documento.children);
  return blocos;
}

export function aviso(codigo: string, categoria: AvisoImportacaoTemplate['categoria'], mensagem: string, elementoId?: string, pagina?: number): AvisoImportacaoTemplate {
  return { id: randomUUID(), codigo, categoria, mensagem, elementoId, pagina };
}
