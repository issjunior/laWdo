import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { gerarDOCXCanonico } from '../../main/services/exportacao.service.js';
import type { DocumentoExportacao } from '../../shared/types/exportacao.types.js';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/Temp/lawdo-test', getAppPath: () => 'C:/Temp/lawdo-test', getName: () => 'laWdoTest', getVersion: () => '0.1.0-test' },
  nativeImage: { createFromBuffer: () => ({ isEmpty: () => false, getSize: () => ({ width: 1200, height: 600 }) }) },
  dialog: {},
}));

describe('figuras no DOCX', () => {
  it('mantém a proporção da fonte e a largura escolhida pelo usuário', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=';
    const documento: DocumentoExportacao = {
      versao: 1,
      fontePadrao: 'Arial',
      tamanhoPadraoPt: 11,
      margens: { top: 2, right: 2, bottom: 2, left: 2 },
      secoes: [{ blocos: [{ tipo: 'figura', base64: png, formato: 'png', larguraPx: 400 }] }],
    };

    const pacote = await JSZip.loadAsync(await gerarDOCXCanonico(documento));
    const xml = await pacote.file('word/document.xml')?.async('text');
    const extensao = new DOMParser().parseFromString(xml ?? '', 'application/xml').getElementsByTagName('wp:extent')[0];
    expect(Number(extensao.getAttribute('cx')) / Number(extensao.getAttribute('cy'))).toBeCloseTo(2, 2);
  });
});
