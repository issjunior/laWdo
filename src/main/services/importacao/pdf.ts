import { extractTextItems, getDocumentProxy, getResolvedPDFJS, type StructuredTextItem } from 'unpdf';
import { randomUUID } from 'crypto';
import { criarHtmlFigura, URL_FIGURA_DUMMY } from '../../../shared/figura/html.js';
import { aviso, blocosDeHtml, escaparHtml, type DocumentoExtraido } from './estrutura.js';
import { reconstruirPdfMarcado } from './pdf-marcado.js';
import { parseDocument, DomUtils } from 'htmlparser2';

type Matriz = [number, number, number, number, number, number];
const identidade = (): Matriz => [1, 0, 0, 1, 0, 0];
function multiplicar(a: Matriz, b: Matriz): Matriz {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
const matriz = (valor: unknown): valor is Matriz => Array.isArray(valor) && valor.length === 6 && valor.every(item => typeof item === 'number' && Number.isFinite(item));
interface LinhaPdf { y: number; x: number; fonte: number; texto: string; colunas: boolean }

function linhasPagina(itens: StructuredTextItem[]): LinhaPdf[] {
  const linhas: { y: number; itens: StructuredTextItem[] }[] = [];
  for (const item of [...itens].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (typeof item.str !== 'string' || ![item.x, item.y, item.fontSize, item.width].every(Number.isFinite)) throw new Error('Coordenadas PDF inválidas');
    if (!item.str.trim()) continue;
    let linha = linhas.at(-1);
    if (!linha || Math.abs(linha.y - item.y) > Math.max(2, item.fontSize * 0.25)) {
      linha = { y: item.y, itens: [] }; linhas.push(linha);
    }
    linha.itens.push(item);
  }
  return linhas.map(linha => {
    const ordenados = linha.itens.sort((a, b) => a.x - b.x);
    let texto = '';
    let colunas = false;
    for (const [indice, item] of ordenados.entries()) {
      const anterior = ordenados[indice - 1];
      const espaco = anterior ? item.x - anterior.x - anterior.width : 0;
      if (espaco > item.fontSize * 3) colunas = true;
      texto += `${anterior && espaco > item.fontSize * 0.15 ? ' ' : ''}${item.str}`;
    }
    return { y: linha.y, x: ordenados[0].x, fonte: Math.max(...ordenados.map(item => item.fontSize)), texto, colunas };
  });
}

export async function lerPdf(dados: Buffer): Promise<DocumentoExtraido> {
  if (!dados.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('O arquivo não contém um PDF válido');
  const pdf = await getDocumentProxy(new Uint8Array(dados), { enableXfa: false, useWasm: false, useWorkerFetch: false, useSystemFonts: false, disableFontFace: true, maxImageSize: 20_000_000 }).catch((erro: unknown) => {
    if (erro instanceof Error && /password/i.test(erro.message)) throw new Error('PDF protegido. Forneça uma cópia desprotegida.');
    throw new Error('Não foi possível abrir o PDF. Confira se o arquivo está íntegro e desprotegido.');
  });
  try {
    if (pdf.numPages > 300) throw new Error('PDF excede o limite de 300 páginas');
    const { items } = await extractTextItems(pdf);
    if (items.reduce((total, pagina) => total + pagina.length, 0) > 100_000) throw new Error('PDF excede o limite de 100000 fragmentos de texto');
    if (!items.some(pagina => pagina.some(item => item.str.trim()))) throw new Error('PDF sem texto extraível. Execute OCR em uma ferramenta externa e importe a cópia com texto.');
    const runtime = await getResolvedPDFJS();
    const linhas = items.map(linhasPagina);
    const margens = new Map<string, Set<number>>();
    const alturas: number[] = [];
    for (let indice = 0; indice < linhas.length; indice++) {
      const pagina = await pdf.getPage(indice + 1);
      const altura = pagina.getViewport({ scale: 1 }).height;
      alturas.push(altura);
      for (const linha of linhas[indice]) {
        if (linha.y > altura * 0.92 || linha.y < altura * 0.08) {
          const chave = `${linha.y > altura / 2 ? 'topo' : 'base'}:${linha.texto.replace(/\d+/g, '#').trim()}`;
          const paginas = margens.get(chave) || new Set<number>(); paginas.add(indice); margens.set(chave, paginas);
        }
      }
    }
    const resultado: DocumentoExtraido = { blocos: [], avisos: [] };
    let removidos = 0;
    for (let indice = 0; indice < linhas.length; indice++) {
      const numero = indice + 1;
      const pagina = await pdf.getPage(numero);
      const fontes = items[indice].map(item => item.fontSize).filter(valor => valor > 0).sort((a, b) => a - b);
      const fonteNormal = fontes[Math.floor(fontes.length / 2)] || 12;
      const elementos: { y: number; html: string }[] = [];
      let paragrafo: { y: number; html: string; ultimaLinha: LinhaPdf } | null = null;
      for (const linha of linhas[indice]) {
        const margem = linha.y > alturas[indice] * 0.92 || linha.y < alturas[indice] * 0.08;
        const chave = `${linha.y > alturas[indice] / 2 ? 'topo' : 'base'}:${linha.texto.replace(/\d+/g, '#').trim()}`;
        const paginacao = linha.texto.match(/^(?:p[aá]gina\s*)?(\d+)(?:\s*(?:\/|de)\s*(\d+))?$/i);
        const numeroPagina = paginacao && Number(paginacao[1]) <= pdf.numPages
          && (!paginacao[2] || Number(paginacao[2]) === pdf.numPages) && (linha.y < alturas[indice] * 0.08 || /^p[aá]gina/i.test(linha.texto));
        const recorrente = (margens.get(chave)?.size || 0) >= Math.max(3, Math.ceil(linhas.length * 0.6)) && linha.fonte < fonteNormal * 0.9;
        if (margem && (numeroPagina || recorrente)) { removidos++; continue; }
        const titulo = linha.texto.length <= 120 && (linha.fonte > fonteNormal * 1.25 || /^\d+[.)ºª\-–—]\s+\D/.test(linha.texto) || /^PRE[ÂA]MBULO$/i.test(linha.texto));
        const unir = !titulo && !linha.colunas && paragrafo && !paragrafo.ultimaLinha.colunas
          && paragrafo.ultimaLinha.y - linha.y < fonteNormal * 1.7 && Math.abs(paragrafo.ultimaLinha.x - linha.x) < fonteNormal * 2;
        if (unir && paragrafo) {
          paragrafo.html += ` ${escaparHtml(linha.texto)}`; paragrafo.ultimaLinha = linha;
        } else {
          if (paragrafo) elementos.push({ y: paragrafo.y, html: `<p>${paragrafo.html}</p>` });
          paragrafo = titulo ? null : { y: linha.y, html: escaparHtml(linha.texto), ultimaLinha: linha };
          if (titulo) elementos.push({ y: linha.y, html: `<h2>${escaparHtml(linha.texto)}</h2>` });
        }
      }
      if (paragrafo) elementos.push({ y: paragrafo.y, html: `<p>${paragrafo.html}</p>` });
      const operacoes = await pagina.getOperatorList({ annotationMode: 0 });
      if (operacoes.fnArray.length > 150_000) throw new Error('Página PDF excede o limite de 150000 operações');
      let atual = identidade();
      const pilha: Matriz[] = [];
      let posicoesIncertas = false;
      let imagensIncertas = 0;
      let imagensConhecidas = 0;
      let desenhoVetorial = false;
      for (let op = 0; op < operacoes.fnArray.length; op++) {
        const codigo = operacoes.fnArray[op];
        const argumentos: unknown = operacoes.argsArray[op];
        if (codigo === runtime.OPS.constructPath) desenhoVetorial = true;
        if (codigo === runtime.OPS.save) pilha.push([...atual]);
        else if (codigo === runtime.OPS.restore) atual = pilha.pop() || identidade();
        else if (codigo === runtime.OPS.transform && matriz(argumentos)) atual = multiplicar(atual, argumentos);
        else if (codigo === runtime.OPS.paintFormXObjectBegin || codigo === runtime.OPS.paintFormXObjectEnd) posicoesIncertas = true;
        else if ([runtime.OPS.paintImageXObject, runtime.OPS.paintInlineImageXObject, runtime.OPS.paintImageMaskXObject].includes(codigo)) {
          if (posicoesIncertas || Math.abs(atual[1]) > 0.01 || Math.abs(atual[2]) > 0.01) imagensIncertas++;
          else { imagensConhecidas++; elementos.push({ y: Math.max(atual[5], atual[5] + atual[3]), html: criarHtmlFigura(URL_FIGURA_DUMMY, randomUUID(), 'XXX', true) }); }
        } else if ([runtime.OPS.paintImageXObjectRepeat, runtime.OPS.paintImageMaskXObjectRepeat, runtime.OPS.paintInlineImageXObjectGroup, runtime.OPS.paintImageMaskXObjectGroup].includes(codigo)) imagensIncertas++;
      }
      const estrutura: unknown = await pagina.getStructTree();
      const conteudoMarcado = estrutura ? await pagina.getTextContent({ includeMarkedContent: true }) : null;
      const marcado = conteudoMarcado ? reconstruirPdfMarcado(estrutura, conteudoMarcado.items) : null;
      const usarMarcado = marcado && !imagensIncertas && marcado.figuras >= imagensConhecidas;
      const temTabelaMarcada = estrutura && JSON.stringify(estrutura).includes('"Table"');
      let mensagem = 'Revise a ordem de leitura, os títulos, cabeçalhos/rodapés e as figuras desta página antes de salvar.';
      if (linhas[indice].some(linha => linha.colunas) || temTabelaMarcada) mensagem += ' Há sinais de tabela/colunas; o texto foi preservado e pode precisar de reconstrução no editor.';
      if (usarMarcado) mensagem += ' A estrutura marcada do PDF foi priorizada; confira também as mesclagens de tabela.';
      if (desenhoVetorial && !usarMarcado) mensagem += ' Há traços vetoriais (desenhos, gráficos ou bordas). Confira quais representam figuras e insira os dummies correspondentes; o leitor não os reconstruiu automaticamente.';
      if (imagensIncertas) mensagem += ` ${imagensIncertas} ocorrência(s) de imagem têm posição incerta. Insira os dummies nos locais corretos ou descarte após revisão.`;
      if (!linhas[indice].length) {
        elementos.push({ y: alturas[indice], html: `<p>Página ${numero}: conteúdo sem texto extraível. Reconstrua com OCR externo ou descarte este trecho.</p>` });
        mensagem = 'Página sem texto extraível: revise o conteúdo ausente, use OCR externo para reconstruí-lo ou descarte o trecho.';
      }
      if (!elementos.length) elementos.push({ y: 0, html: `<p>Página ${numero}: apenas elementos de margem foram reconhecidos. Confirme o descarte ou reconstrua o conteúdo.</p>` });
      const blocos = blocosDeHtml(usarMarcado ? marcado.html : elementos.sort((a, b) => b.y - a.y).map(item => item.html).join(''), numero);
      for (const bloco of blocos) {
        const documento = parseDocument(bloco.html);
        for (const elemento of DomUtils.findAll(no => Boolean(no.attribs['data-importacao-elemento']), documento.children)) elemento.attribs['data-importacao-pagina'] = String(numero);
        bloco.html = DomUtils.getInnerHTML(documento);
      }
      resultado.blocos.push(...blocos);
      resultado.avisos.push(aviso('pdf_estrutura_recuperada', 'limitacao', mensagem, undefined, numero));
      pagina.cleanup();
    }
    if (removidos) resultado.avisos.push(aviso('cabecalhos_rodapes_adaptados', 'adaptacao', `${removidos} linhas recorrentes de margem/paginação foram descartadas. Cabeçalhos e rodapés usarão os padrões do laWdo.`));
    return resultado;
  } catch (erro: unknown) {
    if (erro instanceof Error && /password/i.test(erro.message)) throw new Error('PDF protegido. Forneça uma cópia desprotegida.');
    throw erro;
  } finally {
    await pdf.loadingTask.destroy();
  }
}
