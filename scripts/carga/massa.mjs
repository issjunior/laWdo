import { MASSAS, criarAleatorio, hash } from './configuracao.mjs';

export function gerarBitmap(semente, largura, altura) {
  const aleatorio = criarAleatorio(semente);
  const bytes = Buffer.alloc(largura * altura * 4);
  for (let indice = 0; indice < bytes.length; indice += 4) {
    bytes[indice] = Math.floor(aleatorio() * 256);
    bytes[indice + 1] = Math.floor(aleatorio() * 256);
    bytes[indice + 2] = Math.floor(aleatorio() * 256);
    bytes[indice + 3] = 255;
  }
  return bytes;
}

export function gerarDocumento(nome, imagens) {
  const massa = MASSAS[nome];
  if (!massa || imagens.length !== massa.imagens) throw new Error('Massa ou quantidade de imagens inválida.');
  const trechos = [];
  for (let indice = 0; indice < massa.secoes; indice++) {
    const titulo = indice === massa.secoes - 1 ? 'ILUSTRAÇÕES' : `SEÇÃO FICTÍCIA ${indice + 1}`;
    let conteudo = `<p>MARCADOR_${nome}_${indice} Conteúdo fictício para medição. Nenhum dado pessoal.</p>`;
    for (let numero = indice; numero < massa.placeholders; numero += massa.secoes) conteudo += `<p><span data-placeholder="{{carga_${numero}}}" class="placeholder-tag" contenteditable="false">{{carga_${numero}}}</span></p>`;
    for (let tabela = indice; tabela < massa.tabelas; tabela += massa.secoes) {
      conteudo += `<table><caption>TABELA ${tabela + 1}</caption><tbody>`;
      for (let linha = 0; linha < massa.linhas; linha++) {
        conteudo += '<tr>' + Array.from({ length: massa.colunas }, (_, coluna) => `<td>CARGA_T${tabela}_L${linha}_C${coluna}</td>`).join('') + '</tr>';
      }
      conteudo += '</tbody></table>';
    }
    if (indice === massa.secoes - 1) {
      conteudo += imagens.map((imagem, numero) => `<figure class="laudo-figure" data-image-id="${imagem.id}"><img src="${imagem.dataUri}" alt="Figura ${String(numero + 1).padStart(2, '0')}: Foto fictícia ${numero + 1}"><figcaption>Figura ${String(numero + 1).padStart(2, '0')}: Foto fictícia ${numero + 1}</figcaption></figure><p>SEPARADOR_FIGURA_${numero}</p>`).join('');
    }
    trechos.push(`<h2 data-estrutura-nivel="2" data-secao-id="carga-secao-${indice}" data-titulo-base="${titulo}">${indice + 1}. ${titulo}</h2>\n${conteudo}`);
  }
  const html = trechos.join('\n');
  return { html, resumo: { nome, ...massa, celulas: massa.tabelas * massa.linhas * massa.colunas, bytesHtml: Buffer.byteLength(html), hashHtml: hash(html), imagensHash: imagens.map(imagem => hash(imagem.dataUri)), imagensOriginais: imagens.map(imagem => ({ id: imagem.id, sha256: hash(Buffer.from(imagem.dataUri.split(',')[1], 'base64')) })), marcadores: Array.from({ length: massa.secoes }, (_, indice) => `MARCADOR_${nome}_${indice}`) } };
}
