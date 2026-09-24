import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { gerarDOCXCanonico, gerarODT, verificarLibreOffice } from '../../main/services/exportacao.service.js';
import type { DocumentoExportacao } from '../../shared/types/exportacao.types.js';
import { parseHtmlParaEstrutura } from '../../renderer/lib/exportacao-parser.js';

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
  it('converte o buffer DOCX canônico em pacote ODT quando o LibreOffice está disponível', async () => {
    if (!(await verificarLibreOffice())) return;
    const docx = await gerarDOCXCanonico(documento);
    const odt = await gerarODT(docx);
    expect(Buffer.from(odt).subarray(0, 2).toString('utf8')).toBe('PK');
    expect(odt.byteLength).toBeGreaterThan(1_000);
  }, 30_000);

  it('mantém o conteúdo de células HTML no ODT', async () => {
    if (!(await verificarLibreOffice())) return;
    const estrutura = parseHtmlParaEstrutura('<table><tr><td>TABELA 1 – MATERIAL</td></tr><tr><td>Cartuchos calibre 12</td></tr></table>');
    const docx = await gerarDOCXCanonico(estrutura);
    const arquivo = await JSZip.loadAsync(await gerarODT(docx));
    const xml = await arquivo.file('content.xml')?.async('text');

    expect(xml).toContain('TABELA 1 – MATERIAL');
    expect(xml).toContain('Cartuchos calibre 12');
  }, 30_000);
});
