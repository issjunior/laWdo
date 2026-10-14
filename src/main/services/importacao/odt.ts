import { DomUtils } from 'htmlparser2';
import { randomUUID } from 'crypto';
import { URL_FIGURA_DUMMY } from '../../../shared/figura/html.js';
import { atributoXml, nomeXml, lerEntrada, lerXmlSeguro, abrirPacoteDocumento } from './pacote.js';
import { aviso, blocosDeHtml, escaparHtml, type DocumentoExtraido, type NoDocumento, type ElementoDocumento } from './estrutura.js';

const URI = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0', draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0', fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  manifest: 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
};
const eh = (no: ElementoDocumento, grupo: keyof typeof URI, nome: string): boolean => nomeXml(no) === `${URI[grupo]}|${nome}`;
const CAMPOS_TEXTUAIS = new Set(['variable-input', 'variable-set', 'variable-get', 'user-field-get', 'user-field-input', 'text-input', 'placeholder', 'date', 'time', 'author-name', 'author-initials', 'file-name', 'page-number', 'page-count', 'sequence', 'sequence-ref', 'reference-ref', 'bookmark-ref', 'chapter']);
const METADADOS_TEXTO = new Set(['soft-page-break', 'bookmark', 'bookmark-start', 'bookmark-end', 'sequence-decls', 'variable-decls', 'user-field-decls', 'tracked-changes', 'change-start', 'change-end', 'change']);

export function lerOdt(dados: Buffer): DocumentoExtraido {
  const pacote = abrirPacoteDocumento(dados);
  if (lerEntrada(pacote, 'mimetype') !== 'application/vnd.oasis.opendocument.text') throw new Error('O arquivo não é um documento ODT');
  const manifesto = lerXmlSeguro(lerEntrada(pacote, 'META-INF/manifest.xml'));
  if (DomUtils.findAll(no => eh(no, 'manifest', 'encryption-data'), manifesto.children).length) throw new Error('ODT protegido. Forneça uma cópia desprotegida.');
  const registros = DomUtils.findAll(no => eh(no, 'manifest', 'file-entry'), manifesto.children);
  if (!registros.some(no => atributoXml(no, URI.manifest, 'full-path') === '/' && atributoXml(no, URI.manifest, 'media-type') === 'application/vnd.oasis.opendocument.text')
    || !registros.some(no => atributoXml(no, URI.manifest, 'full-path') === 'content.xml')) throw new Error('Manifesto ODT inválido');
  const conteudo = lerXmlSeguro(lerEntrada(pacote, 'content.xml'));
  const estilosXml = lerEntrada(pacote, 'styles.xml', false);
  const estilos = estilosXml ? lerXmlSeguro(estilosXml).children : [];
  const corpo = DomUtils.findOne(no => eh(no, 'office', 'text'), conteudo.children, true);
  if (!corpo) throw new Error('ODT sem corpo de texto');
  const avisos: DocumentoExtraido['avisos'] = [];
  const mapaEstilos = new Map<string, ElementoDocumento>();
  for (const no of DomUtils.findAll(no => eh(no, 'style', 'style') || eh(no, 'text', 'list-style'), [...estilos, ...conteudo.children])) {
    mapaEstilos.set(atributoXml(no, URI.style, 'name'), no);
  }
  let expansoes = 0;
  const numero = (valor: string, padrao = 1): number => {
    if (!valor) return padrao;
    if (!/^\d+$/.test(valor) || Number(valor) < 1 || Number(valor) > 500) throw new Error('Repetição ou mesclagem ODT excede o limite de 500');
    return Number(valor);
  };
  const formatar = (html: string, nome: string, visitados = new Set<string>()): string => {
    const estilo = mapaEstilos.get(nome);
    if (!estilo || visitados.has(nome) || visitados.size > 10) return html;
    visitados.add(nome);
    const propriedades = DomUtils.findOne(no => eh(no, 'style', 'text-properties'), estilo.children, true);
    if (propriedades) {
      if (atributoXml(propriedades, URI.fo, 'font-weight') === 'bold') html = `<strong>${html}</strong>`;
      if (atributoXml(propriedades, URI.fo, 'font-style') === 'italic') html = `<em>${html}</em>`;
      if (atributoXml(propriedades, URI.style, 'text-underline-style') && atributoXml(propriedades, URI.style, 'text-underline-style') !== 'none') html = `<u>${html}</u>`;
    }
    return formatar(html, atributoXml(estilo, URI.style, 'parent-style-name'), visitados);
  };
  const renderizar = (no: NoDocumento, cabecalho = false): string => {
    if (++expansoes > 30_000) throw new Error('ODT excede o limite de 30000 elementos expandidos');
    if (!DomUtils.isTag(no)) return escaparHtml(DomUtils.textContent(no));
    const filhos = (comoCabecalho = cabecalho) => no.children.map(filho => renderizar(filho, comoCabecalho)).join('');
    const nome = nomeXml(no);
    const nomeLocal = no.name.split(':').at(-1) || '';
    if (eh(no, 'office', 'forms') || (nome.startsWith(`${URI.text}|`) && METADADOS_TEXTO.has(nomeLocal))) return '';
    if (nome.startsWith(`${URI.text}|`) && CAMPOS_TEXTUAIS.has(nomeLocal)) {
      return atributoXml(no, URI.text, 'display') === 'none' ? '' : filhos();
    }
    const estiloNome = atributoXml(no, URI.text, 'style-name');
    if (eh(no, 'text', 'p') || eh(no, 'text', 'h')) {
      const tag = eh(no, 'text', 'h') ? `h${Math.min(6, numero(atributoXml(no, URI.text, 'outline-level')))}` : 'p';
      const legenda = /^(Caption|Legenda|Illustration)$/i.test(estiloNome) ? ' data-importacao-legenda="true"' : '';
      return `<${tag}${legenda}>${formatar(filhos(), estiloNome)}</${tag}>`;
    }
    if (eh(no, 'text', 'span')) return formatar(filhos(), estiloNome);
    if (eh(no, 'text', 's')) return ' '.repeat(numero(atributoXml(no, URI.text, 'c')));
    if (eh(no, 'text', 'tab')) return '    ';
    if (eh(no, 'text', 'line-break')) return '<br>';
    if (eh(no, 'text', 'list')) {
      const estilo = mapaEstilos.get(estiloNome);
      const numerada = estilo && DomUtils.findAll(item => eh(item, 'text', 'list-level-style-number'), estilo.children).length > 0;
      const tag = numerada ? 'ol' : 'ul';
      return `<${tag}>${filhos()}</${tag}>`;
    }
    if (eh(no, 'text', 'list-item') || eh(no, 'text', 'list-header')) return `<li>${filhos()}</li>`;
    if (eh(no, 'table', 'table')) return `<table><tbody>${filhos()}</tbody></table>`;
    if (eh(no, 'table', 'table-header-rows')) return filhos(true);
    if (eh(no, 'table', 'table-row')) {
      const repeticoes = numero(atributoXml(no, URI.table, 'number-rows-repeated'));
      return Array.from({ length: repeticoes }, () => `<tr>${filhos()}</tr>`).join('');
    }
    if (eh(no, 'table', 'covered-table-cell') || eh(no, 'table', 'table-column')) return '';
    if (eh(no, 'table', 'table-cell')) {
      const repeticoes = numero(atributoXml(no, URI.table, 'number-columns-repeated'));
      const colunas = numero(atributoXml(no, URI.table, 'number-columns-spanned'));
      const linhas = numero(atributoXml(no, URI.table, 'number-rows-spanned'));
      const tag = cabecalho ? 'th' : 'td';
      return Array.from({ length: repeticoes }, () => { if (++expansoes > 30_000) throw new Error('ODT excede o limite de expansão'); return `<${tag} colspan="${colunas}" rowspan="${linhas}">${filhos()}</${tag}>`; }).join('');
    }
    if (eh(no, 'draw', 'image') || eh(no, 'draw', 'object') || eh(no, 'draw', 'object-ole')) return `<img src="${URL_FIGURA_DUMMY}" alt="Figura XX">`;
    if (eh(no, 'draw', 'frame')) {
      const reconhecido = DomUtils.findAll(item => eh(item, 'draw', 'image') || eh(item, 'draw', 'object') || eh(item, 'draw', 'object-ole') || eh(item, 'draw', 'text-box'), no.children).length;
      return reconhecido ? filhos() : `<img src="${URL_FIGURA_DUMMY}" alt="Figura XX">`;
    }
    if (nomeXml(no).startsWith(`${URI.draw}|`) && !eh(no, 'draw', 'text-box')) return `<img src="${URL_FIGURA_DUMMY}" alt="Figura XX">`;
    if (eh(no, 'text', 'section') || eh(no, 'table', 'table-rows') || eh(no, 'table', 'table-row-group') || eh(no, 'draw', 'text-box') || eh(no, 'text', 'a')) return filhos();
    const recuperado = filhos();
    if (!recuperado.trim()) {
      avisos.push(aviso('odt_conteudo_nao_recuperado', 'limitacao', 'Alguns elementos do arquivo original não puderam ser recuperados. Compare o conteúdo importado com o documento original.'));
      return recuperado;
    }
    const id = randomUUID();
    const temBlocos = DomUtils.findAll(filho => eh(filho, 'text', 'p') || eh(filho, 'text', 'h') || eh(filho, 'text', 'list') || eh(filho, 'table', 'table'), no.children).length > 0;
    avisos.push(aviso('odt_formatacao_adaptada', 'adaptacao', 'Parte da apresentação foi adaptada; o conteúdo disponível foi preservado.', temBlocos ? undefined : id));
    return temBlocos ? recuperado : `<span data-importacao-elemento="${id}">${recuperado}</span>`;
  };
  const html = corpo.children.map(no => renderizar(no)).join('');
  if (DomUtils.findAll(no => eh(no, 'style', 'header') || eh(no, 'style', 'footer'), estilos).length) avisos.push(aviso('cabecalhos_rodapes_adaptados', 'adaptacao', 'Cabeçalhos e rodapés originais foram descartados; serão usados os padrões do laWdo.'));
  return { blocos: blocosDeHtml(html), avisos };
}
