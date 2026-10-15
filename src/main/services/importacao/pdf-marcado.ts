import { criarHtmlFigura, URL_FIGURA_DUMMY } from '../../../shared/figura/html.js';
import { randomUUID } from 'crypto';
import { escaparHtml } from './estrutura.js';

const objeto = (valor: unknown): valor is Record<string, unknown> => valor !== null && typeof valor === 'object';

export function reconstruirPdfMarcado(estrutura: unknown, itens: unknown[]): { html: string; figuras: number } | null {
  if (!estrutura) return null;
  const fragmentos = new Map<string, string[]>();
  const pilha: (string | null)[] = [];
  let total = 0;
  let foraDeMarcacao = false;
  for (const item of itens) {
    if (!objeto(item)) return null;
    if (item.type === 'beginMarkedContent' || item.type === 'beginMarkedContentProps') pilha.push(typeof item.id === 'string' ? item.id : null);
    else if (item.type === 'endMarkedContent') pilha.pop();
    else if (typeof item.str === 'string' && item.str.trim()) {
      const identificador = [...pilha].reverse().find(valor => valor !== null);
      if (!identificador) { foraDeMarcacao = true; continue; }
      const lista = fragmentos.get(identificador) || [];
      lista.push(item.str); fragmentos.set(identificador, lista);
      total++;
    }
  }
  if (foraDeMarcacao || !total) return null;
  const usados = new Set<string>();
  let figuras = 0;
  let quantidade = 0;
  const renderizar = (no: unknown, nivel: number): string => {
    if (++quantidade > 100_000 || nivel > 80) throw new Error('Estrutura marcada PDF excede o limite de complexidade');
    if (!objeto(no)) return '';
    if (no.type === 'content' && typeof no.id === 'string') {
      if (usados.has(no.id)) return '';
      usados.add(no.id);
      return escaparHtml((fragmentos.get(no.id) || []).join(' '));
    }
    if (typeof no.role !== 'string' || !Array.isArray(no.children)) return '';
    if (no.role === 'Figure') {
      const marcar = (item: unknown, profundidade: number) => {
        if (profundidade > 80) throw new Error('Figura marcada PDF excede o limite de complexidade');
        if (!objeto(item)) return;
        if (item.type === 'content' && typeof item.id === 'string') usados.add(item.id);
        if (Array.isArray(item.children)) for (const filho of item.children) marcar(filho, profundidade + 1);
      };
      marcar(no, nivel);
      figuras++;
      return criarHtmlFigura(URL_FIGURA_DUMMY, randomUUID(), 'XXX', true);
    }
    const filhos = no.children.map(filho => renderizar(filho, nivel + 1)).join('');
    const tags: Record<string, string> = { P: 'p', H: 'h2', H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h5', H6: 'h6', L: 'ul', LI: 'li', LBody: 'span', Lbl: 'strong', Table: 'table', TR: 'tr', TH: 'th', TD: 'td', THead: 'thead', TBody: 'tbody', TFoot: 'tfoot', BlockQuote: 'blockquote', Span: 'span' };
    const tag = tags[no.role];
    return tag ? `<${tag}>${filhos}</${tag}>` : filhos;
  };
  const html = renderizar(estrutura, 0);
  if ([...fragmentos.keys()].some(id => !usados.has(id))) return null;
  return { html, figuras };
}
