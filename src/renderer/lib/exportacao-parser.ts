import type { AlinhamentoDocumento, BlocoExportacao, DocumentoExportacao, EstiloTextoExportacao, ListaExportacao, ParagrafoExportacao, TrechoExportacao } from '@shared/types/exportacao.types';
import { elementoEhQuebraPagina, normalizarQuebrasPaginaHtml } from '@shared/utils/quebra-pagina';
const numero = (v: string | null): number | undefined => { const n = Number.parseFloat(v || ''); return Number.isFinite(n) ? n : undefined; };
const cor = (v: string): string | undefined => { const m = v.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i); return m ? (m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1]).toUpperCase() : undefined; };
const corDeFundoExportavel = (v: string): string | undefined => { const valor = cor(v); return valor && !['000000', '18181B', '1A1A1A'].includes(valor) ? valor : undefined; };
const alinhamento = (e: Element): AlinhamentoDocumento | undefined => (e.getAttribute('style') || '').match(/text-align:\s*(left|center|right|justify)/i)?.[1]?.toLowerCase() as AlinhamentoDocumento | undefined;
function estilo(e: Element, p: EstiloTextoExportacao = {}): EstiloTextoExportacao { const t = e.tagName.toLowerCase(), c = e.getAttribute('style') || ''; return { ...p, negrito: p.negrito || /^(b|strong)$/.test(t) || /font-weight:\s*(bold|[6-9]00)/i.test(c), italico: p.italico || /^(i|em)$/.test(t) || /font-style:\s*italic/i.test(c), sublinhado: p.sublinhado || t === 'u' || /text-decoration[^;]*underline/i.test(c), tachado: p.tachado || /^(s|strike)$/.test(t) || /text-decoration[^;]*line-through/i.test(c), subscrito: p.subscrito || t === 'sub', sobrescrito: p.sobrescrito || t === 'sup', fonte: c.match(/font-family:\s*([^;,]+)/i)?.[1]?.replace(/["']/g, '').trim() || p.fonte, tamanhoPt: numero(c.match(/font-size:\s*([\d.]+)pt/i)?.[1] || null) || p.tamanhoPt, cor: cor(c.match(/(?:^|;)\s*color:\s*([^;]+)/i)?.[1] || '') || p.cor, realce: cor(c.match(/background-color:\s*([^;]+)/i)?.[1] || '') || p.realce, link: t === 'a' ? e.getAttribute('href') || undefined : p.link }; }
function trechos(n: Node, p: EstiloTextoExportacao = {}): TrechoExportacao[] { if (n.nodeType === Node.TEXT_NODE) return n.textContent ? [{ texto: n.textContent, estilo: p }] : []; if (n.nodeType !== Node.ELEMENT_NODE) return []; const e = n as Element; if (e.tagName.toLowerCase() === 'br') return [{ texto: '', estilo: p, quebraLinha: true }]; return Array.from(e.childNodes).flatMap(f => trechos(f, estilo(e, p))); }
function paragrafo(e: Element): ParagrafoExportacao { const c = e.getAttribute('style') || '', h = /^h([1-6])$/i.exec(e.tagName)?.[1]; return { tipo: 'paragrafo', trechos: trechos(e), alinhamento: alinhamento(e), nivelTitulo: h ? Number(h) : undefined, citacao: e.tagName.toLowerCase() === 'blockquote', preFormatado: e.tagName.toLowerCase() === 'pre', recuoEsquerdoPt: numero(c.match(/margin-left:\s*([\d.]+)pt/i)?.[1] || null), recuoDireitoPt: numero(c.match(/margin-right:\s*([\d.]+)pt/i)?.[1] || null), recuoPrimeiraLinhaPt: numero(c.match(/text-indent:\s*([\d.]+)pt/i)?.[1] || null), espacamentoAntesPt: numero(c.match(/margin-top:\s*([\d.]+)pt/i)?.[1] || null), espacamentoDepoisPt: numero(c.match(/margin-bottom:\s*([\d.]+)pt/i)?.[1] || null), espacamentoLinha: numero(c.match(/line-height:\s*([\d.]+)/i)?.[1] || null) }; }
function lista(e: Element, nivel = 0): ListaExportacao[] { const itens: ParagrafoExportacao[] = [], sub: ListaExportacao[] = []; for (const li of Array.from(e.querySelectorAll(':scope > li'))) { const c = li.cloneNode(true) as Element; c.querySelectorAll(':scope > ul,:scope > ol').forEach(x => x.remove()); itens.push(paragrafo(c)); li.querySelectorAll(':scope > ul,:scope > ol').forEach(x => sub.push(...lista(x, nivel + 1))); } return [{ tipo: 'lista', ordenada: e.tagName.toLowerCase() === 'ol', nivel, itens }, ...sub]; }
function blocosCelula(celula: Element): BlocoExportacao[] {
  const resultado: BlocoExportacao[] = [];
  let grupoInline = celula.cloneNode(false) as Element;
  const concluirGrupo = () => {
    if (grupoInline.textContent?.trim() || grupoInline.querySelector('br')) resultado.push(paragrafo(grupoInline));
    grupoInline = celula.cloneNode(false) as Element;
  };

  for (const no of Array.from(celula.childNodes)) {
    if (no.nodeType !== Node.ELEMENT_NODE || !/^(p|div|blockquote|pre|h[1-6]|ul|ol|hr|table|figure|img)$/i.test((no as Element).tagName)) {
      grupoInline.appendChild(no.cloneNode(true));
      continue;
    }
    concluirGrupo();
    const contenedor = celula.ownerDocument.createElement('div');
    contenedor.appendChild(no.cloneNode(true));
    resultado.push(...blocos(contenedor));
  }
  concluirGrupo();
  return resultado;
}

function blocos(p: Element): BlocoExportacao[] {
  const resultado: BlocoExportacao[] = [];
  for (const elemento of Array.from(p.children)) {
    const tipo = elemento.tagName.toLowerCase();
    if (elemento.matches('[data-placeholder-preview],[data-laudo-secao-header],.tox,button')) continue;
    if (elementoEhQuebraPagina(elemento)) {
      resultado.push({ tipo: 'quebra-pagina' });
      continue;
    }
    if (tipo === 'ul' || tipo === 'ol') {
      resultado.push(...lista(elemento));
      continue;
    }
    if (tipo === 'hr') {
      resultado.push({ tipo: 'linha-horizontal' });
      continue;
    }
    if (tipo === 'table') {
      const legenda = elemento.querySelector(':scope > caption');
      if (legenda?.textContent?.trim()) resultado.push(paragrafo(legenda));
      resultado.push({
        tipo: 'tabela',
        linhas: Array.from(elemento.querySelectorAll(':scope > thead > tr,:scope > tbody > tr,:scope > tr')).map(linha =>
          Array.from(linha.querySelectorAll(':scope > th,:scope > td')).map(celula => {
            const conteudo = blocosCelula(celula);
            return {
              paragrafos: conteudo.filter((bloco): bloco is ParagrafoExportacao => bloco.tipo === 'paragrafo'),
              blocos: conteudo,
              colspan: Number(celula.getAttribute('colspan')) || undefined,
              rowspan: Number(celula.getAttribute('rowspan')) || undefined,
              corFundo: corDeFundoExportavel(celula.getAttribute('style') || ''),
            };
          })
        ),
      });
      continue;
    }
    const imagem = tipo === 'img' ? elemento : elemento.querySelector('img');
    const dados = imagem?.getAttribute('src')?.match(/^data:image\/(\w+);base64,(.+)$/i);
    if ((tipo === 'figure' || tipo === 'img') && dados) {
      const css = imagem?.getAttribute('style') || '';
      resultado.push({
        tipo: 'figura', formato: dados[1] === 'jpeg' ? 'jpg' : dados[1], base64: dados[2],
        larguraPx: numero(imagem?.getAttribute('width') || null) || numero(css.match(/width:\s*([\d.]+)px/i)?.[1] || null),
        alturaPx: numero(imagem?.getAttribute('height') || null) || numero(css.match(/height:\s*([\d.]+)px/i)?.[1] || null),
        alinhamento: alinhamento(elemento),
        legenda: elemento.querySelector('figcaption') ? paragrafo(elemento.querySelector('figcaption')!) : undefined,
      });
      continue;
    }
    if (/^(p|div|blockquote|pre|h[1-6])$/.test(tipo)) resultado.push(paragrafo(elemento));
    else resultado.push(...blocos(elemento));
  }
  return resultado;
}
export function parseHtmlParaEstrutura(html: string): DocumentoExportacao { const d = new DOMParser().parseFromString(normalizarQuebrasPaginaHtml(html), 'text/html'); const c = d.body.getAttribute('style') || ''; return { versao: 1, fontePadrao: c.match(/font-family:\s*([^;,]+)/i)?.[1]?.replace(/["']/g, '').trim() || 'Calibri', tamanhoPadraoPt: numero(c.match(/font-size:\s*([\d.]+)pt/i)?.[1] || null) || 12, secoes: [{ blocos: blocos(d.body) }] }; }
