import { distribuirLargurasColunas, pesoColunaTabela, planejarGruposColunas } from '@shared/utils/tabelas-balistica-layout';

export function ajustarTabelasBalistica(raiz: ParentNode, larguraCm = 16, dividir = false): void {
  const documento = raiz.ownerDocument ?? (raiz as Document);
  const contexto = typeof CanvasRenderingContext2D === 'undefined' ? null : documento.createElement('canvas').getContext('2d');
  const largura = larguraCm * 96 / 2.54;
  raiz.querySelectorAll<HTMLTableElement>('table[data-tabela-laudo="balistica"]').forEach(tabela => {
    if (tabela.closest('[data-placeholder-tabela-personalizada]')) return;
    tabela.style.tableLayout = 'auto';
    for (const celula of tabela.querySelectorAll<HTMLElement>('th,td')) {
      celula.style.whiteSpace = 'normal';
      celula.style.wordBreak = 'normal';
      celula.style.overflowWrap = 'normal';
      celula.style.hyphens = 'none';
      celula.style.padding = '4px 3px';
    }
    const cabecalho = tabela.tHead?.rows[tabela.tHead.rows.length - 1];
    if (!cabecalho || [...cabecalho.cells].some(celula => celula.colSpan !== 1)) return;
    if (tabela.rows[0] === cabecalho || tabela.rows[0].cells.length !== 1) return;
    const linhas = Array.from(tabela.rows).filter(linha => linha !== tabela.rows[0]);
    if (linhas.some(linha => linha.cells.length !== cabecalho.cells.length || [...linha.cells].some(c => c.colSpan !== 1 || c.rowSpan !== 1))) return;
    const titulos = [...cabecalho.cells].map(celula => celula.textContent || '');
    const minimos = titulos.map((_, indice) => Math.max(...linhas.map(linha => {
      const celula = linha.cells[indice];
      if (contexto) contexto.font = `${celula.tagName === 'TH' ? '600 ' : ''}${celula.style.fontSize || tabela.style.fontSize || '12px'} Arial`;
      return Math.max(0, ...(celula.textContent || '').split(/[ \t\r\n\f\u200b]+/).map(palavra => contexto?.measureText(palavra).width ?? palavra.length * 7)) + 12;
    })));
    const grupos = dividir ? planejarGruposColunas(minimos, largura) : [titulos.map((_, indice) => indice)];
    grupos.forEach((indices, parte) => {
      const destino = grupos.length > 1 ? tabela.cloneNode(true) as HTMLTableElement : tabela;
      destino.querySelectorAll(':scope > colgroup').forEach(colunas => colunas.remove());
      const colunas = documento.createElement('colgroup');
      const larguras = distribuirLargurasColunas(indices.map(i => minimos[i]), indices.map(i => pesoColunaTabela(titulos[i])), largura);
      larguras.forEach(valor => {
        const coluna = documento.createElement('col');
        coluna.style.width = `${valor}%`;
        colunas.append(coluna);
      });
      destino.prepend(colunas);
      for (const linha of Array.from(destino.rows).slice(1)) {
        Array.from(linha.cells).forEach((celula, indice) => { if (!indices.includes(indice)) celula.remove(); });
        for (const celula of linha.cells) celula.style.removeProperty('width');
      }
      if (grupos.length > 1) {
        const titulo = destino.rows[0].cells[0];
        titulo.colSpan = indices.length;
        titulo.append(documento.createTextNode(` — parte ${parte + 1}/${grupos.length}`));
        destino.setAttribute('data-tabela-laudo-parte', String(parte + 1));
        tabela.before(destino);
      }
    });
    if (grupos.length > 1) tabela.remove();
  });
}
