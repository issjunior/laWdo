import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { lerPdf } from '../../main/services/importacao/pdf';
import { transformarDocumento } from '../../main/services/importacao/transformacao';
import { reconstruirPdfMarcado } from '../../main/services/importacao/pdf-marcado';

beforeAll(() => vi.stubGlobal('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor));
afterAll(() => vi.unstubAllGlobals());

function criarPdf(texto: string, paginas = 1): Buffer {
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${paginas} /Kids [${Array.from({ length: paginas }, (_, indice) => `${5 + indice} 0 R`).join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(texto)} >>\nstream\n${texto}\nendstream`,
    ...Array.from({ length: paginas }, () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>'),
  ];
  let conteudo = '%PDF-1.4\n';
  const posicoes = [0];
  objetos.forEach((objeto, indice) => {
    posicoes.push(Buffer.byteLength(conteudo));
    conteudo += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(conteudo);
  conteudo += `xref\n0 ${posicoes.length}\n0000000000 65535 f \n`;
  conteudo += posicoes.slice(1).map(posicao => `${String(posicao).padStart(10, '0')} 00000 n \n`).join('');
  conteudo += `trailer\n<< /Size ${posicoes.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return Buffer.from(conteudo);
}

describe('leitura de PDF sintético sem serviços externos', () => {
  it('extrai título e texto de PDF real e conserva placeholders na transformação', async () => {
    const dados = criarPdf('BT /F1 20 Tf 40 700 Td (PREAMBULO) Tj /F1 12 Tf 0 -30 Td (Texto {{numero}} preservado) Tj 0 -15 Td (Continuacao do paragrafo) Tj ET');
    const extraido = await lerPdf(dados);
    const resultado = transformarDocumento(extraido, 'Amostra', 'pdf');
    expect(resultado.secoes.map(secao => secao.nome)).toEqual(['PREAMBULO']);
    const documento = new DOMParser().parseFromString(resultado.secoes[0].conteudo, 'text/html');
    expect(documento.body.textContent).toContain('Texto {{numero}} preservado Continuacao do paragrafo');
    expect(extraido.blocos.every(bloco => bloco.pagina === 1)).toBe(true);
    expect(resultado.avisos).toEqual(expect.arrayContaining([expect.objectContaining({ categoria: 'limitacao', pagina: 1 })]));
  });

  it('orienta OCR quando o PDF não possui texto e permite ler outro arquivo após a falha', async () => {
    await expect(lerPdf(criarPdf(''))).rejects.toThrow('OCR');
    const extraido = await lerPdf(criarPdf('BT /F1 12 Tf 40 700 Td (Texto recuperado) Tj ET'));
    expect(extraido.blocos.map(bloco => bloco.html).join('')).toContain('Texto recuperado');
  });

  it('recusa conteúdo inválido e PDF acima do limite de páginas', async () => {
    await expect(lerPdf(Buffer.from('arquivo sem assinatura'))).rejects.toThrow('PDF válido');
    await expect(lerPdf(Buffer.from('%PDF-1.4\narquivo corrompido'))).rejects.toThrow('Confira se o arquivo está íntegro');
    await expect(lerPdf(criarPdf('', 301))).rejects.toThrow('limite de 300 páginas');
  });

  it('reconstrói tabela marcada e recusa estrutura que perderia fragmentos de texto', () => {
    const estrutura = { role: 'Table', children: [{ role: 'TR', children: [
      { role: 'TH', children: [{ type: 'content', id: 'cabecalho' }] },
      { role: 'TD', children: [{ type: 'content', id: 'valor' }] },
    ] }] };
    const itens = [
      { type: 'beginMarkedContentProps', id: 'cabecalho' }, { str: 'Campo' }, { type: 'endMarkedContent' },
      { type: 'beginMarkedContentProps', id: 'valor' }, { str: '{{numero}}' }, { type: 'endMarkedContent' },
    ];
    expect(reconstruirPdfMarcado(estrutura, itens)).toEqual({ html: '<table><tr><th>Campo</th><td>{{numero}}</td></tr></table>', figuras: 0 });
    expect(reconstruirPdfMarcado(estrutura, [...itens, { str: 'Texto sem vínculo' }])).toBeNull();
    expect(reconstruirPdfMarcado(estrutura, [...itens,
      { type: 'beginMarkedContentProps', id: 'fora-da-arvore' }, { str: 'Texto vinculado ausente da árvore' }, { type: 'endMarkedContent' },
    ])).toBeNull();
  });
});
