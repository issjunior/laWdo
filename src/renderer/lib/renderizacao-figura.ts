import type { AjustesFigura, TextoFigura } from '@shared/types/imagem-laudo.types';

const limitar = (valor: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, valor));
const CORES: Record<TextoFigura['cor'], string> = { branco: '#ffffff', preto: '#000000', vermelho: '#dc2626', amarelo: '#facc15', azul: '#2563eb' };
const TAMANHOS: Record<TextoFigura['tamanho'], number> = { pequeno: 0.035, medio: 0.05, grande: 0.075 };

export function normalizarAnguloFigura(angulo: number): number {
  if (!Number.isFinite(angulo)) return 0;
  const reduzido = angulo % 360;
  return Number((reduzido > 180 ? reduzido - 360 : reduzido < -180 ? reduzido + 360 : reduzido).toFixed(1));
}

export async function carregarImagemFigura(origem: string): Promise<HTMLImageElement> {
  const imagem = new Image();
  imagem.src = origem;
  await imagem.decode();
  return imagem;
}

export interface AreaTextoFigura {
  id: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

function linhasTexto(contexto: CanvasRenderingContext2D, conteudo: string, largura: number): string[] {
  return conteudo.split('\n').flatMap(paragrafo => {
    const linhas: string[] = [];
    let linha = '';
    for (const caractere of paragrafo) {
      if (linha && contexto.measureText(linha + caractere).width > largura) {
        linhas.push(linha);
        linha = '';
      }
      linha += caractere;
    }
    return [...linhas, linha];
  });
}

export function desenharTextosFigura(canvas: HTMLCanvasElement, textos: TextoFigura[]): AreaTextoFigura[] {
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Não foi possível editar a figura.');
  return textos.map(texto => {
    let fonte = Math.max(1, canvas.height * TAMANHOS[texto.tamanho]);
    contexto.font = `${fonte}px Arial, sans-serif`;
    let linhas = linhasTexto(contexto, texto.conteudo, canvas.width * 0.9);
    if (linhas.length * fonte * 1.2 > canvas.height * 0.9) {
      fonte *= canvas.height * 0.9 / (linhas.length * fonte * 1.2);
      contexto.font = `${fonte}px Arial, sans-serif`;
      linhas = linhasTexto(contexto, texto.conteudo, canvas.width * 0.9);
    }
    const margem = fonte * 0.15;
    const largura = Math.min(canvas.width, Math.max(fonte, ...linhas.map(linha => contexto.measureText(linha).width)) + margem * 2);
    const altura = Math.min(canvas.height, linhas.length * fonte * 1.2 + margem * 2);
    const x = limitar(canvas.width * texto.x / 100 - largura / 2, 0, canvas.width - largura);
    const y = limitar(canvas.height * texto.y / 100 - altura / 2, 0, canvas.height - altura);
    contexto.fillStyle = CORES[texto.cor];
    contexto.strokeStyle = texto.cor === 'preto' ? '#ffffff' : '#000000';
    contexto.lineWidth = Math.max(0.5, fonte * 0.09);
    contexto.lineJoin = 'round';
    contexto.textBaseline = 'top';
    contexto.textAlign = 'left';
    linhas.forEach((linha, indice) => {
      const topo = y + margem + indice * fonte * 1.2;
      contexto.strokeText(linha, x + margem, topo);
      contexto.fillText(linha, x + margem, topo);
    });
    return { id: texto.id, x, y, largura, altura };
  });
}

export function renderizarFigura(imagem: HTMLImageElement, ajustes: AjustesFigura, limite?: number): HTMLCanvasElement {
  const radianos = normalizarAnguloFigura(ajustes.angulo) * Math.PI / 180;
  const larguraOriginal = Math.max(1, Math.ceil(Math.abs(imagem.width * Math.cos(radianos)) + Math.abs(imagem.height * Math.sin(radianos)) - 1e-8));
  const alturaOriginal = Math.max(1, Math.ceil(Math.abs(imagem.width * Math.sin(radianos)) + Math.abs(imagem.height * Math.cos(radianos)) - 1e-8));
  const escala = limite ? Math.min(1, limite / Math.max(larguraOriginal, alturaOriginal)) : 1;
  const largura = Math.max(1, Math.round(larguraOriginal * escala));
  const altura = Math.max(1, Math.round(alturaOriginal * escala));
  const orientada = document.createElement('canvas');
  orientada.width = largura;
  orientada.height = altura;
  const contexto = orientada.getContext('2d');
  if (!contexto) throw new Error('Não foi possível editar a figura.');
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, largura, altura);
  contexto.translate(largura / 2, altura / 2);
  contexto.rotate(radianos);
  contexto.scale(ajustes.espelharHorizontal ? -escala : escala, ajustes.espelharVertical ? -escala : escala);
  contexto.drawImage(imagem, -imagem.width / 2, -imagem.height / 2);
  const { x, y } = ajustes.corte;
  const origemX = limitar(Math.round(largura * x / 100), 0, largura - 1);
  const origemY = limitar(Math.round(altura * y / 100), 0, altura - 1);
  const larguraCorte = limitar(Math.round(largura * ajustes.corte.largura / 100), 1, largura - origemX);
  const alturaCorte = limitar(Math.round(altura * ajustes.corte.altura / 100), 1, altura - origemY);
  const resultado = document.createElement('canvas');
  resultado.width = larguraCorte;
  resultado.height = alturaCorte;
  const contextoFinal = resultado.getContext('2d');
  if (!contextoFinal) throw new Error('Não foi possível editar a figura.');
  contextoFinal.drawImage(orientada, origemX, origemY, larguraCorte, alturaCorte, 0, 0, larguraCorte, alturaCorte);
  return resultado;
}

export async function transformarFigura(origem: string, ajustes: AjustesFigura): Promise<string> {
  const canvas = renderizarFigura(await carregarImagemFigura(origem), ajustes);
  if (ajustes.textos?.length) desenharTextosFigura(canvas, ajustes.textos);
  return canvas.toDataURL('image/png');
}
