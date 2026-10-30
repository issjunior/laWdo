import AdmZip from 'adm-zip';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { lerDocx } from '../../main/services/importacao/docx';
import { lerOdt } from '../../main/services/importacao/odt';
import { abrirPacoteDocumento, lerEntrada, lerXmlSeguro } from '../../main/services/importacao/pacote';
import { blocosDeHtml } from '../../main/services/importacao/estrutura';
import { transformarDocumento } from '../../main/services/importacao/transformacao';
import { sanitizarHtmlImportacao } from '../../main/services/importacao/sanitizacao';
import { URL_FIGURA_DUMMY } from '../../shared/figura/html';

beforeAll(() => vi.stubGlobal('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor));
afterAll(() => vi.unstubAllGlobals());

function empacotar(arquivos: Record<string, string>): Buffer {
  const pacote = new AdmZip();
  for (const [nome, conteudo] of Object.entries(arquivos)) pacote.addFile(nome, Buffer.from(conteudo));
  return pacote.toBuffer();
}

const manifestoOdt = '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>';
function criarOdt(corpo: string): Buffer {
  return empacotar({
    mimetype: 'application/vnd.oasis.opendocument.text', 'META-INF/manifest.xml': manifestoOdt,
    'content.xml': `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"><office:body><office:text>${corpo}</office:text></office:body></office:document-content>`,
  });
}

describe('importação de documentos sintéticos', () => {
  it('lê DOCX real e conserva texto, tabela e placeholder dividido em runs', async () => {
    const dados = empacotar({
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Antes {{nu</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>mero}} depois</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Célula preservada</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
    });
    const resultado = transformarDocumento(await lerDocx(dados), 'Amostra', 'docx');
    const documento = new DOMParser().parseFromString(resultado.secoes[0].conteudo, 'text/html');
    expect(documento.body.textContent).toContain('Antes {{numero}} depois');
    expect(documento.body.innerHTML).toContain('{{numero}}');
    expect(documento.querySelector('td')?.textContent).toBe('Célula preservada');
    expect(resultado.resumo).toEqual({ tabelas: 1, figuras: 0 });
  });

  it('lê ODT real com título, mesclagem, campos fragmentados e imagem substituída', () => {
    const dados = criarOdt('<text:h text:outline-level="1">EXAME</text:h><text:p>Antes {{nu<text:span>mero}}</text:span> depois</text:p><table:table><table:table-row><table:table-cell table:number-columns-spanned="2"><text:p>Conteúdo da tabela</text:p></table:table-cell><table:covered-table-cell/></table:table-row></table:table><text:p><draw:frame><draw:image/></draw:frame></text:p>');
    const resultado = transformarDocumento(lerOdt(dados), 'Amostra', 'odt');
    expect(resultado.secoes.map(secao => secao.nome)).toEqual(['EXAME']);
    const documento = new DOMParser().parseFromString(resultado.secoes[0].conteudo, 'text/html');
    expect(documento.body.textContent).toContain('Antes {{numero}} depois');
    expect(documento.querySelector('td')?.getAttribute('colspan')).toBe('2');
    expect(documento.querySelector('td')?.textContent).toBe('Conteúdo da tabela');
    expect(documento.querySelector('figure')?.getAttribute('data-dummy')).toBe('true');
    expect(documento.querySelector('img')?.getAttribute('src')).toBe(URL_FIGURA_DUMMY);
    expect(resultado.resumo).toEqual({ tabelas: 1, figuras: 1 });
  });

  it('limpa HTML inseguro sem apagar texto, mesclagem válida e identidade da figura', () => {
    const html = '<p onclick="roubar()" style="text-align:center;background:url(https://invalido)">Texto <strong>mantido</strong><script>roubar()</script><iframe src="https://invalido"></iframe><a href="javascript:roubar()">referência</a></p><table><tr><td colspan="2" rowspan="999">Célula</td></tr></table><figure data-image-id="figura-local"><img src="https://invalido/foto.png" onerror="roubar()"></figure>';
    const resultado = transformarDocumento({ blocos: blocosDeHtml(html), avisos: [] }, 'Amostra', 'docx');
    const documento = new DOMParser().parseFromString(resultado.secoes[0].conteudo, 'text/html');
    expect(documento.body.textContent).toContain('Texto mantidoreferência');
    expect(documento.querySelector('script, iframe, [onclick], [onerror], [href]')).toBeNull();
    expect(documento.querySelector('p')?.style.textAlign).toBe('center');
    expect(documento.body.innerHTML).not.toContain('https://invalido');
    expect(documento.querySelector('td')?.getAttribute('colspan')).toBe('2');
    expect(documento.querySelector('td')?.hasAttribute('rowspan')).toBe(false);
    expect(documento.querySelector('figure')?.getAttribute('data-image-id')).toBe('figura-local');
    expect(documento.querySelector('img')?.getAttribute('src')).toBe(URL_FIGURA_DUMMY);
    const persistido = sanitizarHtmlImportacao(documento.body.innerHTML, false);
    expect(persistido).not.toContain('data-importacao-');
    expect(persistido).toContain('figura-local');
  });

  it.each([
    { caso: 'entidade externa', xml: '<!DOCTYPE raiz [<!ENTITY externa SYSTEM "file:///segredo">]><raiz>&externa;</raiz>' },
    { caso: 'entidade desconhecida', xml: '<raiz>&desconhecida;</raiz>' },
    { caso: 'fechamento incorreto', xml: '<raiz><filho></raiz>' },
    { caso: 'múltiplas raízes', xml: '<raiz/><outra/>' },
    { caso: 'profundidade excessiva', xml: '<raiz>'.repeat(81) + '</raiz>'.repeat(81) },
  ])('recusa XML inseguro ou malformado: $caso', ({ xml }) => {
    expect(() => lerXmlSeguro(xml)).toThrow();
  });

  it('recusa CRC inválido e limites declarados antes de descompactar conteúdo excessivo', () => {
    const pacote = abrirPacoteDocumento(empacotar({ 'content.xml': '<raiz>Texto</raiz>' }));
    const entrada = pacote.get('content.xml');
    if (!entrada) throw new Error('Entrada sintética ausente');
    expect(lerEntrada(pacote, 'content.xml')).toBe('<raiz>Texto</raiz>');
    entrada.header.crc ^= 1;
    expect(() => lerEntrada(pacote, 'content.xml')).toThrow('CRC inválido');
    entrada.header.size = 12 * 1024 * 1024 + 1;
    expect(() => lerEntrada(pacote, 'content.xml')).toThrow('limite de 12 MB');
  });

  it('recusa pacote não ZIP, DOCX incompleto e repetição ODT excessiva', async () => {
    expect(() => abrirPacoteDocumento(Buffer.from('invalido'))).toThrow('ZIP válido');
    await expect(lerDocx(empacotar({ 'content.xml': '<raiz/>' }))).rejects.toThrow('Estrutura DOCX inválida');
    expect(() => lerOdt(criarOdt('<table:table><table:table-row table:number-rows-repeated="501"/></table:table>'))).toThrow('limite de 500');
    expect(() => transformarDocumento({ blocos: [], avisos: [] }, 'Vazio', 'odt')).toThrow('Nenhum conteúdo recuperável');
  });

  it.each(['caminho externo', 'tamanho excessivo'])('recusa ZIP com %s sem extrair arquivos', caso => {
    const dados = empacotar({ 'content.xml': '<raiz/>' });
    const inicio = dados.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    if (inicio < 0) throw new Error('Diretório central sintético ausente');
    if (caso === 'caminho externo') {
      Buffer.from('../evil.xml').copy(dados, inicio + 46);
      expect(() => abrirPacoteDocumento(dados)).toThrow('Caminho inválido');
    } else {
      dados.writeUInt32LE(32 * 1024 * 1024 + 1, inicio + 24);
      expect(() => abrirPacoteDocumento(dados)).toThrow('limite descompactado');
    }
  });
});
