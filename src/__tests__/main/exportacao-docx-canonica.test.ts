import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { gerarDOCXCanonico, gerarODT, verificarLibreOffice } from '../../main/services/exportacao.service.js';
import type { DocumentoExportacao } from '../../shared/types/exportacao.types.js';
import { parseHtmlParaEstrutura } from '../../renderer/lib/exportacao-parser.js';
import { reconstruirHtmlEstrutural } from '../../renderer/lib/estrutura-laudo';

function documentoSemContarOculta() {
  return parseHtmlParaEstrutura(reconstruirHtmlEstrutural([
    { id: 'inicio', nivel: 2, titulo: 'PREÂMBULO', ocultarTitulo: true, contarNaNumeracao: false, conteudo: '<p>Texto inicial</p>' },
    { id: 'sub', parentId: 'inicio', nivel: 3, titulo: 'SUBSEÇÃO', conteudo: '<p>Texto filho</p>' },
    { id: 'fim', nivel: 2, titulo: 'OBJETIVO', conteudo: '<p>Texto final</p>' },
  ]));
}

const documento: DocumentoExportacao = {
  versao: 1, fontePadrao: 'Arial', tamanhoPadraoPt: 11,
  margens: { top: 2, right: 2, bottom: 2, left: 2 },
  secoes: [{ blocos: [
    { tipo: 'paragrafo', alinhamento: 'justify', recuoPrimeiraLinhaPt: 28.35, trechos: [{ texto: 'texto ', estilo: { negrito: true, cor: '123456' } }, { texto: 'ligação', estilo: { link: 'https://exemplo.test', sublinhado: true } }] },
    { tipo: 'lista', ordenada: true, nivel: 0, itens: [{ tipo: 'paragrafo', trechos: [{ texto: 'item' }] }] },
    { tipo: 'tabela', linhas: [[{ colspan: 2, corFundo: 'EEEEEE', paragrafos: [{ tipo: 'paragrafo', trechos: [{ texto: 'célula' }] }] }]] },
    { tipo: 'linha-horizontal' },
    { tipo: 'quebra-pagina' },
  ] }],
};

describe('gerarDOCXCanonico', () => {
  it('grava margens explícitas de zero sem alterar a altura da linha no DOCX', async () => {
    const estrutura = parseHtmlParaEstrutura('<p style="margin-top:0pt;margin-bottom:0pt;line-height:1.7">Sem espaço adicional</p>');
    const arquivo = await JSZip.loadAsync(await gerarDOCXCanonico(estrutura));
    const xml = await arquivo.file('word/document.xml')?.async('text');
    const documentoXml = new DOMParser().parseFromString(xml ?? '', 'application/xml');
    const espacamento = documentoXml.getElementsByTagName('w:spacing')[0];
    expect(espacamento.getAttribute('w:before')).toBe('0');
    expect(espacamento.getAttribute('w:after')).toBe('0');
    expect(espacamento.getAttribute('w:line')).toBe('408');
  });
  it('mantém o fechamento após o corpo em uma única linha de tabela sem bordas e sem divisão', async () => {
    const estrutura = parseHtmlParaEstrutura('<p>Corpo do laudo</p><div data-laudo-fechamento="true" data-espacamento-antes-pt="36"><p style="text-align:center;"><strong>Perito preservado</strong></p><p>Unidade preservada</p></div>');
    const arquivo = await JSZip.loadAsync(await gerarDOCXCanonico(estrutura));
    const xml = await arquivo.file('word/document.xml')?.async('text');
    expect(xml).toContain('<w:cantSplit');
    expect(xml).toContain('w:w="720"');
    expect(xml).toContain('w:val="none"');
    expect(xml?.indexOf('Corpo do laudo')).toBeLessThan(xml?.indexOf('Perito preservado') ?? 0);
    expect(xml?.match(/Perito preservado/g)).toHaveLength(1);
  });
  it('usa a sequência sem contar o pai oculto e preserva a subseção sem número no DOCX', async () => {
    const arquivo = await JSZip.loadAsync(await gerarDOCXCanonico(documentoSemContarOculta()));
    const xml = await arquivo.file('word/document.xml')?.async('text');
    expect(xml).not.toContain('PREÂMBULO');
    expect(xml).toContain('SUBSEÇÃO');
    expect(xml).not.toContain('1.1 SUBSEÇÃO');
    expect(xml).toContain('1. OBJETIVO');
    expect(xml).toContain('Texto inicial');
    expect(xml).toContain('Texto filho');
  });

  it('omite os títulos marcados no arquivo final, preservando texto e numeração', async () => {
    const estrutura = parseHtmlParaEstrutura('<h2 data-ocultar-titulo="true">1. PREÂMBULO</h2><p>Texto inicial</p><h2>2. OBJETIVO</h2><p>Texto final</p>');
    const arquivo = await JSZip.loadAsync(await gerarDOCXCanonico(estrutura));
    const xml = await arquivo.file('word/document.xml')?.async('text');
    expect(xml).not.toContain('PREÂMBULO');
    expect(xml).toContain('Texto inicial');
    expect(xml).toContain('2. OBJETIVO');
    expect(xml).toContain('Texto final');
  });

  it('produz um pacote DOCX nativo para o documento canônico', async () => {
    const buffer = await gerarDOCXCanonico(documento);
    expect(Buffer.from(buffer).subarray(0, 2).toString('utf8')).toBe('PK');
    expect(buffer.byteLength).toBeGreaterThan(1_000);
  });

  it('serializa o recuo da primeira linha e a quebra de página nativos', async () => {
    const arquivo = await JSZip.loadAsync(await gerarDOCXCanonico(documento));
    const xml = await arquivo.file('word/document.xml')?.async('text');

    expect(xml).toContain('w:firstLine="567"');
    expect(xml).toContain('w:type="page"');
  });

  it('mantém o conteúdo de células HTML no DOCX', async () => {
    const estrutura = parseHtmlParaEstrutura('<table><tr><td>TABELA 1 – MATERIAL</td></tr><tr><td>Cartuchos calibre 12</td></tr></table>');
    const arquivo = await JSZip.loadAsync(await gerarDOCXCanonico(estrutura));
    const xml = await arquivo.file('word/document.xml')?.async('text');

    expect(xml).toContain('TABELA 1 – MATERIAL');
    expect(xml).toContain('Cartuchos calibre 12');
  });
});

describe('gerarODT', () => {
  it('preserva a sequência e subseções sem número no ODT', async () => {
    if (!(await verificarLibreOffice())) return;
    const arquivo = await JSZip.loadAsync(await gerarODT(await gerarDOCXCanonico(documentoSemContarOculta())));
    const xml = await arquivo.file('content.xml')?.async('text');
    expect(xml).not.toContain('PREÂMBULO');
    expect(xml).toContain('SUBSEÇÃO');
    expect(xml).not.toContain('1.1 SUBSEÇÃO');
    expect(xml).toContain('1. OBJETIVO');
    expect(xml).toContain('Texto filho');
  }, 60_000);

  it('omite títulos ocultos no ODT convertido sem remover o conteúdo', async () => {
    if (!(await verificarLibreOffice())) return;
    const estrutura = parseHtmlParaEstrutura('<h2 data-ocultar-titulo="true">1. PREÂMBULO</h2><p>Texto inicial</p><h2>2. OBJETIVO</h2>');
    const arquivo = await JSZip.loadAsync(await gerarODT(await gerarDOCXCanonico(estrutura)));
    const xml = await arquivo.file('content.xml')?.async('text');
    expect(xml).not.toContain('PREÂMBULO');
    expect(xml).toContain('Texto inicial');
    expect(xml).toContain('2. OBJETIVO');
  }, 60_000);

  it('converte o buffer DOCX canônico em pacote ODT quando o LibreOffice está disponível', async () => {
    if (!(await verificarLibreOffice())) return;
    const docx = await gerarDOCXCanonico(documento);
    const odt = await gerarODT(docx);
    expect(Buffer.from(odt).subarray(0, 2).toString('utf8')).toBe('PK');
    expect(odt.byteLength).toBeGreaterThan(1_000);
  }, 60_000);

  it('mantém o conteúdo de células HTML no ODT', async () => {
    if (!(await verificarLibreOffice())) return;
    const estrutura = parseHtmlParaEstrutura('<table><tr><td>TABELA 1 – MATERIAL</td></tr><tr><td>Cartuchos calibre 12</td></tr></table>');
    const docx = await gerarDOCXCanonico(estrutura);
    const arquivo = await JSZip.loadAsync(await gerarODT(docx));
    const xml = await arquivo.file('content.xml')?.async('text');

    expect(xml).toContain('TABELA 1 – MATERIAL');
    expect(xml).toContain('Cartuchos calibre 12');
  }, 60_000);
});
