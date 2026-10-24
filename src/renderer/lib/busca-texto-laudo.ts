interface PosicaoTexto {
  no: Text;
  inicio: number;
  fim: number;
}

export interface OcorrenciaTextoLaudo {
  intervalo: Range;
}

const BLOCOS = /^(P|DIV|LI|H[1-6]|TD|TH|TR|TABLE|FIGCAPTION|BLOCKQUOTE|SECTION|PRE|BR)$/;
const IGNORADOS = 'script,style,button,input,select,textarea,[hidden],[aria-hidden="true"],[data-acao-tabela-placeholder],[data-acao-bloco-condicional],[data-mce-bogus="all"]';

export function normalizarTermoBusca(texto: string): string {
  return texto.replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');
}

export function buscarTextoNoLaudo(raiz: HTMLElement, termo: string): OcorrenciaTextoLaudo[] {
  const consulta = normalizarTermoBusca(termo).trim();
  if (!consulta) return [];
  const resultado: OcorrenciaTextoLaudo[] = [];
  let texto = '';
  let posicoes: PosicaoTexto[] = [];
  const concluir = () => {
    let inicio = texto.indexOf(consulta);
    while (inicio !== -1) {
      const primeiro = posicoes[inicio];
      const ultimo = posicoes[inicio + consulta.length - 1];
      const intervalo = raiz.ownerDocument.createRange();
      intervalo.setStart(primeiro.no, primeiro.inicio);
      intervalo.setEnd(ultimo.no, ultimo.fim);
      resultado.push({ intervalo });
      inicio = texto.indexOf(consulta, inicio + consulta.length);
    }
    texto = '';
    posicoes = [];
  };
  const visitar = (no: Node) => {
    if (no.nodeType === Node.TEXT_NODE) {
      const noTexto = no as Text;
      let deslocamento = 0;
      for (const caractere of noTexto.data) {
        const fim = deslocamento + caractere.length;
        const normalizado = normalizarTermoBusca(caractere);
        if (normalizado === ' ' && texto.endsWith(' ')) {
          posicoes[posicoes.length - 1] = { ...posicoes[posicoes.length - 1], no: noTexto, fim };
        } else {
          texto += normalizado;
          for (let indice = 0; indice < normalizado.length; indice++) posicoes.push({ no: noTexto, inicio: deslocamento, fim });
        }
        deslocamento = fim;
      }
      return;
    }
    if (no.nodeType !== Node.ELEMENT_NODE) return;
    const elemento = no as HTMLElement;
    if (elemento.matches(IGNORADOS) || elemento.style.display === 'none' || elemento.style.visibility === 'hidden') return;
    const bloco = BLOCOS.test(elemento.tagName);
    if (bloco) concluir();
    elemento.childNodes.forEach(visitar);
    if (bloco) concluir();
  };
  raiz.childNodes.forEach(visitar);
  concluir();
  return resultado;
}

export function rolarAteTextoLaudo(intervalo: Range, iframe?: HTMLIFrameElement | null): boolean {
  const obterRetanguloTexto = () => Array.from(intervalo.getClientRects()).find(retangulo => retangulo.height > 0 && retangulo.width > 0);
  if (!obterRetanguloTexto()) return false;

  const rolarDocumento = (inicio: HTMLElement | null, obterRetangulo: () => { top: number; height: number } | undefined) => {
    if (!inicio) return;
    const documento = inicio.ownerDocument;
    const janela = documento.defaultView;
    if (!janela) return;
    const raiz = documento.scrollingElement || documento.documentElement;
    const ancestrais: Element[] = [];
    for (let elemento: HTMLElement | null = inicio; elemento; elemento = elemento.parentElement) {
      if (elemento !== raiz && /(auto|scroll)/.test(janela.getComputedStyle(elemento).overflowY)
        && elemento.scrollHeight > elemento.clientHeight) ancestrais.push(elemento);
    }
    if (raiz.scrollHeight > janela.innerHeight) ancestrais.push(raiz);

    for (const elemento of ancestrais) {
      const retangulo = obterRetangulo();
      if (!retangulo) continue;
      const caixa = elemento.getBoundingClientRect();
      const inicioArea = elemento === raiz ? 0 : caixa.top + elemento.clientTop;
      const altura = elemento === raiz ? janela.innerHeight : elemento.clientHeight;
      const controles = Array.from(documento.querySelectorAll<HTMLElement>('[data-barra-busca-laudo], .tox-editor-header'))
        .filter(controle => elemento.contains(controle));
      const margemSuperior = controles.reduce((margem, controle) => {
        const posicao = janela.getComputedStyle(controle).position;
        return posicao === 'sticky' || posicao === 'fixed' ? margem + controle.getBoundingClientRect().height : margem;
      }, 16);
      const centro = inicioArea + Math.min(margemSuperior, altura / 3) + Math.max(0, altura - Math.min(margemSuperior, altura / 3) - 16) / 2;
      const destino = elemento.scrollTop + retangulo.top + retangulo.height / 2 - centro;
      const maximo = Math.max(0, elemento.scrollHeight - altura);
      elemento.scrollTo({ top: Math.min(maximo, Math.max(0, destino)), behavior: 'instant' });
    }
  };

  rolarDocumento(intervalo.startContainer.parentElement, obterRetanguloTexto);
  if (iframe) {
    rolarDocumento(iframe.parentElement, () => {
      const texto = obterRetanguloTexto();
      if (!texto) return undefined;
      const caixaIframe = iframe.getBoundingClientRect();
      const escala = iframe.offsetHeight > 0 ? caixaIframe.height / iframe.offsetHeight : 1;
      return { top: caixaIframe.top + (iframe.clientTop + texto.top) * escala, height: texto.height * escala };
    });
  }
  return true;
}
