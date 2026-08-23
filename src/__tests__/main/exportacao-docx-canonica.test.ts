import { describe, expect, it } from 'vitest';
import { gerarDOCXCanonico, gerarODT, verificarLibreOffice } from '../../main/services/exportacao.service.js';
import type { DocumentoExportacao } from '../../shared/types/exportacao.types.js';

const documento: DocumentoExportacao = {
  versao: 1, fontePadrao: 'Arial', tamanhoPadraoPt: 11,
  margens: { top: 2, right: 2, bottom: 2, left: 2 },
  secoes: [{ blocos: [
    { tipo: 'paragrafo', alinhamento: 'justify', trechos: [{ texto: 'texto ', estilo: { negrito: true, cor: '123456' } }, { texto: 'ligação', estilo: { link: 'https://exemplo.test', sublinhado: true } }] },
    { tipo: 'lista', ordenada: true, nivel: 0, itens: [{ tipo: 'paragrafo', trechos: [{ texto: 'item' }] }] },
    { tipo: 'tabela', linhas: [[{ colspan: 2, corFundo: 'EEEEEE', paragrafos: [{ tipo: 'paragrafo', trechos: [{ texto: 'célula' }] }] }]] },
    { tipo: 'linha-horizontal' },
  ] }],
};

describe('gerarDOCXCanonico', () => {
  it('produz um pacote DOCX nativo para o documento canônico', async () => {
    const buffer = await gerarDOCXCanonico(documento);
    expect(Buffer.from(buffer).subarray(0, 2).toString('utf8')).toBe('PK');
    expect(buffer.byteLength).toBeGreaterThan(1_000);
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
});
