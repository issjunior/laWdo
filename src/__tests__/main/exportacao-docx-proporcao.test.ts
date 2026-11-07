vi.mock('../../main/services/processador-imagens.service.js', async () => import('../apoio/processador-imagens-simulado'));
import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import sharp from 'sharp';
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

  it('compõe pares enquadrados em caixas 3:2 sem distorcer o conteúdo', async () => {
    const imagens = await Promise.all([
      { width: 40, height: 80, channels: 3 as const, background: { r: 255, g: 0, b: 0 } },
      { width: 80, height: 40, channels: 3 as const, background: { r: 0, g: 0, b: 255 } },
    ].map(create => sharp({ create }).png().toBuffer()));
    const documento: DocumentoExportacao = {
      versao: 1,
      fontePadrao: 'Arial',
      tamanhoPadraoPt: 11,
      secoes: [{ blocos: [{
        tipo: 'tabela',
        linhas: [imagens.map(bytes => ({
          paragrafos: [],
          blocos: [{ tipo: 'figura' as const, base64: bytes.toString('base64'), formato: 'png', enquadramento: 'conter-3x2' as const }],
        }))],
      }] }],
    };

    const pacote = await JSZip.loadAsync(await gerarDOCXCanonico(documento));
    const xml = await pacote.file('word/document.xml')?.async('text');
    const extensoes = Array.from(new DOMParser().parseFromString(xml ?? '', 'application/xml').getElementsByTagName('wp:extent'));
    expect(extensoes).toHaveLength(2);
    extensoes.forEach(extensao => {
      expect(Number(extensao.getAttribute('cx')) / Number(extensao.getAttribute('cy'))).toBeCloseTo(1.5, 2);
    });
    const midias = Object.values(pacote.files).filter(arquivo => arquivo.name.startsWith('word/media/') && !arquivo.dir);
    expect(midias).toHaveLength(2);
    for (const midia of midias) {
      const metadados = await sharp(await midia.async('nodebuffer')).metadata();
      expect((metadados.width || 0) / (metadados.height || 1)).toBeCloseTo(1.5, 2);
    }
  });

  it.each([
    [67, 100 / 67],
    [75, 4 / 3],
    [100, 1],
    [125, 0.8],
    [150, 2 / 3],
  ] as const)('compõe a altura de %s%% na proporção correspondente', async (alturaParPercentual, proporcao) => {
    const bytes = await sharp({
      create: { width: 40, height: 80, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();
    const documento: DocumentoExportacao = {
      versao: 1,
      fontePadrao: 'Arial',
      tamanhoPadraoPt: 11,
      secoes: [{ blocos: [{
        tipo: 'figura', base64: bytes.toString('base64'), formato: 'png', alturaParPercentual,
      }] }],
    };

    const pacote = await JSZip.loadAsync(await gerarDOCXCanonico(documento));
    const xml = await pacote.file('word/document.xml')?.async('text');
    const extensao = new DOMParser().parseFromString(xml ?? '', 'application/xml').getElementsByTagName('wp:extent')[0];
    expect(Number(extensao.getAttribute('cx')) / Number(extensao.getAttribute('cy'))).toBeCloseTo(proporcao, 2);
    const midia = Object.values(pacote.files).find(arquivo => arquivo.name.startsWith('word/media/') && !arquivo.dir);
    expect(midia).toBeDefined();
    const metadados = await sharp(await midia!.async('nodebuffer')).metadata();
    expect((metadados.width || 0) / (metadados.height || 1)).toBeCloseTo(proporcao, 2);
  });

  it('preenche o quadro sob comando e preserva a margem branca na foto inteira', async () => {
    const bytes = await sharp({
      create: { width: 40, height: 80, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();
    const documento: DocumentoExportacao = {
      versao: 1,
      fontePadrao: 'Arial',
      tamanhoPadraoPt: 11,
      secoes: [{ blocos: [{
        tipo: 'tabela',
        linhas: [[
          { paragrafos: [], blocos: [{ tipo: 'figura', base64: bytes.toString('base64'), formato: 'png', alturaParPercentual: 67, ajusteVisualPar: 'preencher' }] },
          { paragrafos: [], blocos: [{ tipo: 'figura', base64: bytes.toString('base64'), formato: 'png', alturaParPercentual: 67, ajusteVisualPar: 'conter' }] },
        ]],
      }] }],
    };

    const pacote = await JSZip.loadAsync(await gerarDOCXCanonico(documento));
    const midias = Object.values(pacote.files).filter(arquivo => arquivo.name.startsWith('word/media/') && !arquivo.dir);
    expect(midias).toHaveLength(2);
    const pixels = await Promise.all(midias.map(async midia => {
      const { data } = await sharp(await midia.async('nodebuffer')).raw().toBuffer({ resolveWithObject: true });
      return { data };
    }));
    const preenchida = pixels.find(({ data }) => data[0] === 255 && data[1] === 0 && data[2] === 0);
    const inteira = pixels.find(({ data }) => data[0] === 255 && data[1] === 255 && data[2] === 255);
    expect(preenchida).toBeDefined();
    expect(inteira).toBeDefined();
  });
});
