import { obterCampoFormulario, type MetadadoPlaceholderIndice } from './indice-placeholders';

export interface ContextoCampoLaudo {
  nome: string;
  unidade?: string;
  tabela?: string;
  secao?: string;
  trecho?: string;
}

const PADRAO_UNIDADE = /^(?:PQ\s*\d+|(?:Estojo|Item|Arma)\s+\d+)$/i;

function normalizarTexto(valor: string | null | undefined): string {
  return (valor || '').replace(/\s+/g, ' ').trim();
}

function textoVisivel(elemento: Element | null): string {
  if (!elemento) return '';
  const copia = elemento.cloneNode(true) as Element;
  copia.querySelectorAll('script, style, [data-mce-bogus], [data-laudo-secao-header], [data-controles-conteudo], [data-cond-suprimido="true"], .controles-bloco-condicional, [hidden], [aria-hidden="true"], select, button').forEach(no => no.remove());
  return normalizarTexto(copia.textContent);
}

function obterTrecho(campo: HTMLElement): string {
  const origem = campo.closest('p, td, th, li') || campo;
  const copia = origem.cloneNode(true) as Element;
  const caminho: number[] = [];
  let atual: Node = campo;
  while (atual !== origem && atual.parentNode) {
    caminho.unshift(Array.from(atual.parentNode.childNodes).indexOf(atual as ChildNode));
    atual = atual.parentNode;
  }
  let alvo: Node = copia;
  for (const indice of caminho) alvo = alvo.childNodes[indice];
  const marcador = '\uFFF0';
  alvo.textContent = marcador;
  const textoMarcado = textoVisivel(copia);
  const posicao = textoMarcado.indexOf(marcador);
  const texto = textoMarcado.replace(marcador, textoVisivel(campo));
  if (texto.length <= 160) return texto;
  const inicio = Math.max(0, Math.min(posicao - 60, texto.length - 158));
  return `${inicio ? '…' : ''}${texto.slice(inicio, inicio + 158)}${inicio + 158 < texto.length ? '…' : ''}`;
}

function obterContextoTabela(campo: HTMLElement): { nome?: string; unidade?: string; titulo?: string } {
  const celula = campo.closest<HTMLTableCellElement>('td, th');
  const tabela = celula?.closest('table');
  if (!celula || !tabela) return {};
  const primeiraCelula = tabela.rows[0]?.cells[0];
  const titulo = textoVisivel(tabela.caption) || (/^TABELA\s+\d+\b/i.test(textoVisivel(primeiraCelula)) ? textoVisivel(primeiraCelula) : '');
  const grade: HTMLTableCellElement[][] = [];
  let linhaAlvo = -1;
  let colunaAlvo = -1;
  Array.from(tabela.rows).forEach((linha, indiceLinha) => {
    grade[indiceLinha] ??= [];
    let coluna = 0;
    Array.from(linha.cells).forEach(item => {
      while (grade[indiceLinha][coluna]) coluna++;
      if (item === celula) { linhaAlvo = indiceLinha; colunaAlvo = coluna; }
      const altura = item.rowSpan || Array.from(tabela.rows).slice(indiceLinha).filter(outra => outra.parentElement === linha.parentElement).length;
      for (let deslocamentoLinha = 0; deslocamentoLinha < altura; deslocamentoLinha++) {
        grade[indiceLinha + deslocamentoLinha] ??= [];
        for (let deslocamentoColuna = 0; deslocamentoColuna < item.colSpan; deslocamentoColuna++) {
          grade[indiceLinha + deslocamentoLinha][coluna + deslocamentoColuna] = item;
        }
      }
      coluna += item.colSpan;
    });
  });
  if (linhaAlvo < 0 || colunaAlvo < 0) return { titulo };
  const ehRotulo = (item: HTMLTableCellElement) => item.tagName === 'TH' || item.getAttribute('data-placeholder-celula-fixa') === 'true';
  const valido = (item: HTMLTableCellElement) => item !== celula && textoVisivel(item) !== titulo && !item.querySelector('[data-reservado], [data-placeholder], [data-placeholder-personalizado-html]');
  const linha = grade[linhaAlvo];
  // Cabeçalhos mesclados só identificam o alvo quando abrangem toda a sua largura/altura.
  const rotuloLinha = [...new Set(linha.slice(0, colunaAlvo))].reverse().find(item => valido(item) && ehRotulo(item)
    && Array.from({ length: celula.rowSpan || 1 }, (_, indice) => grade[linhaAlvo + indice]?.includes(item)).every(Boolean));
  const rotuloColuna = [...new Set(grade.slice(0, linhaAlvo).map(item => item[colunaAlvo]).filter(Boolean))].reverse().find(item => valido(item) && ehRotulo(item)
    && Array.from({ length: celula.colSpan }, (_, indice) => grade.slice(0, linhaAlvo).some(linhaAnterior => linhaAnterior[colunaAlvo + indice] === item)).every(Boolean));
  const textoLinha = textoVisivel(rotuloLinha || null).replace(/:$/, '');
  const textoColuna = textoVisivel(rotuloColuna || null).replace(/:$/, '');
  const primeira = linha[0];
  const identificador = primeira && primeira !== celula && valido(primeira) ? textoVisivel(primeira) : '';
  const cabecalhoIdentificador = grade.slice(0, linhaAlvo).map(item => item[0]).filter(Boolean).reverse().find(item => ehRotulo(item) && /^(ID|Item|Arma|Estojo)$/i.test(textoVisivel(item)));
  const unidade = [textoLinha, textoColuna, identificador].find(texto => PADRAO_UNIDADE.test(texto))
    || (cabecalhoIdentificador && /^\d+$/.test(identificador) ? `${/^ID$/i.test(textoVisivel(cabecalhoIdentificador)) ? 'Item' : textoVisivel(cabecalhoIdentificador)} ${identificador}` : undefined);
  const nomes = [...new Set([textoLinha, textoColuna].filter(texto => texto && !PADRAO_UNIDADE.test(texto)))];
  return { nome: nomes.join(' · ') || undefined, unidade, titulo: titulo || undefined };
}

export function obterContextoCampoLaudo(
  campo: HTMLElement,
  metadados: MetadadoPlaceholderIndice[],
  secao?: string,
): ContextoCampoLaudo {
  const tabela = obterContextoTabela(campo);
  const aviso = normalizarTexto(campo.getAttribute('data-aviso-reservado'));
  const descricao = aviso.replace(/^Campo (?:de preenchimento manual no (?:laudo|template)|pendente na REP):?\s*/i, '');
  const partes = descricao.match(/^(.*?)\s+[—–]\s+((?:PQ\s*\d+|(?:Estojo|Item|Arma)\s+\d+))$/i);
  const chave = campo.getAttribute('data-placeholder')?.match(/^\{\{([^{}]+)\}\}$/)?.[1]
    || campo.getAttribute('data-campo-rep-pendente');
  const nomeCatalogo = chave ? obterCampoFormulario(chave, metadados) : '';
  const nome = partes?.[1] || (descricao !== 'Campo de preenchimento manual no template' ? descricao : '')
    || (nomeCatalogo !== 'Campo não identificado' ? nomeCatalogo : '') || tabela.nome;
  const cabecalhoSecao = campo.closest('[data-laudo-secao]')?.querySelector(':scope > [data-laudo-secao-header]');
  const tituloSecao = normalizarTexto(secao) || normalizarTexto(cabecalhoSecao?.getAttribute('data-titulo-base'));
  const trecho = nome ? undefined : obterTrecho(campo);
  return {
    nome: nome || 'Texto personalizado',
    unidade: partes?.[2] || tabela.unidade,
    tabela: tabela.titulo?.replace(/^TABELA\s+(\d+)\s*[–—-]\s*/i, 'Tabela $1 · '),
    secao: tituloSecao || undefined,
    trecho: trecho || undefined,
  };
}
