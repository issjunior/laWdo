import mammoth from 'mammoth';
import { parseDocument, DomUtils } from 'htmlparser2';
import { URL_FIGURA_DUMMY } from '../../../shared/figura/html.js';
import { abrirPacoteDocumento, lerEntrada, lerXmlSeguro } from './pacote.js';
import { aviso, blocosDeHtml, type DocumentoExtraido } from './estrutura.js';

export async function lerDocx(dados: Buffer): Promise<DocumentoExtraido> {
  const pacote = abrirPacoteDocumento(dados);
  if (!pacote.has('[Content_Types].xml') || !pacote.has('word/document.xml') || !pacote.has('_rels/.rels')) throw new Error('Estrutura DOCX inválida');
  for (const nome of pacote.keys()) {
    if (nome.endsWith('.xml') || nome.endsWith('.rels')) lerXmlSeguro(lerEntrada(pacote, nome));
  }
  const resultado = await mammoth.convertToHtml({ buffer: dados }, {
    ignoreEmptyParagraphs: false, externalFileAccess: false, includeEmbeddedStyleMap: false,
    styleMap: ["p[style-name='Caption'] => p.importacao-legenda:fresh", "p[style-name='Legenda'] => p.importacao-legenda:fresh"],
    convertImage: mammoth.images.imgElement(async () => ({ src: URL_FIGURA_DUMMY })),
  });
  const documento = parseDocument(resultado.value);
  for (const legenda of DomUtils.findAll(no => no.attribs.class === 'importacao-legenda', documento.children)) legenda.attribs['data-importacao-legenda'] = 'true';
  const blocos = blocosDeHtml(DomUtils.getInnerHTML(documento));
  const avisos = resultado.messages.map(mensagem => aviso(`docx_conversao_${mensagem.type}`, 'limitacao', `Conversão DOCX: ${mensagem.message}`));
  if ([...pacote.keys()].some(nome => /^word\/(header|footer)\d*\.xml$/.test(nome))) avisos.push(aviso('cabecalhos_rodapes_adaptados', 'adaptacao', 'Cabeçalhos e rodapés originais foram descartados; serão usados os padrões do laWdo.'));
  return { blocos, avisos };
}
