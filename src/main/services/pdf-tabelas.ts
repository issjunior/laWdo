import { distribuirLargurasColunas, ESTILOS_TABELAS_BALISTICA, pesoColunaTabela, planejarGruposColunas } from '../../shared/utils/tabelas-balistica-layout.js';

export const ESTILOS_TABELAS_PLACEHOLDER_PDF = `
  table[border="0"] > tr > :is(th, td),
  table[border="0"] > :is(thead, tbody, tfoot) > tr > :is(th, td) { border: 0; }
  table:not([data-tabela-laudo="balistica"]):has([data-placeholder-celula-fixa]) {
    table-layout: fixed; width: 100% !important; max-width: 100% !important;
  }
  table:not([data-tabela-laudo="balistica"]):has([data-placeholder-celula-fixa]) th,
  table:not([data-tabela-laudo="balistica"]):has([data-placeholder-celula-fixa]) td {
    padding: 4px 3px !important; overflow-wrap: anywhere !important; white-space: normal !important;
  }
  table:not([data-tabela-laudo="balistica"]):has([data-placeholder-celula-fixa]):has(tr > :nth-child(10)) th,
  table:not([data-tabela-laudo="balistica"]):has([data-placeholder-celula-fixa]):has(tr > :nth-child(10)) td {
    font-size: 10px !important; line-height: 1.3;
  }
  ${ESTILOS_TABELAS_BALISTICA}
`;

function ajustarTabelasDocumento(largura: number): void {
  const contexto = document.createElement('canvas').getContext('2d');
  if (!contexto) throw new Error('Não foi possível medir o texto das tabelas.');
  document.body.style.width = `${largura}px`;
  document.querySelectorAll<HTMLTableElement>('table[data-tabela-laudo="balistica"]').forEach(tabela => {
    const cabecalho = tabela.tHead?.rows[tabela.tHead.rows.length - 1];
    if (!cabecalho || Array.from(cabecalho.cells).some(celula => celula.colSpan !== 1)) return;
    if (tabela.rows[0] === cabecalho || tabela.rows[0].cells.length !== 1) return;
    const linhas = Array.from(tabela.rows).slice(1);
    if (linhas.some(linha => linha.cells.length !== cabecalho.cells.length || Array.from(linha.cells).some(c => c.colSpan !== 1 || c.rowSpan !== 1))) return;
    const titulos = Array.from(cabecalho.cells).map(celula => celula.textContent || '');
    const minimos = titulos.map((_, indice) => Math.max(...linhas.map(linha => {
      const celula = linha.cells[indice];
      const estilo = getComputedStyle(celula);
      contexto.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
      return Math.max(0, ...(celula.textContent || '').split(/[ \t\r\n\f\u200b]+/).map(palavra => contexto.measureText(palavra).width)) + 12;
    })));
    const grupos = planejarGruposColunas(minimos, largura);
    grupos.forEach((indices, parte) => {
      if (indices.reduce((soma, indice) => soma + minimos[indice], 0) > largura) {
        throw new Error('Uma palavra da tabela é maior que a largura útil. Revise o conteúdo ou as margens.');
      }
      const destino = grupos.length > 1 ? tabela.cloneNode(true) as HTMLTableElement : tabela;
      destino.querySelectorAll(':scope > colgroup').forEach(colunas => colunas.remove());
      const colunas = document.createElement('colgroup');
      const larguras = distribuirLargurasColunas(indices.map(i => minimos[i]), indices.map(i => pesoColunaTabela(titulos[i])), largura);
      larguras.forEach(valor => {
        const coluna = document.createElement('col');
        coluna.style.width = `${valor}%`;
        colunas.append(coluna);
      });
      destino.prepend(colunas);
      for (const linha of Array.from(destino.rows).slice(1)) {
        Array.from(linha.cells).forEach((celula, indice) => { if (!indices.includes(indice)) celula.remove(); });
        for (const celula of Array.from(linha.cells)) celula.style.removeProperty('width');
      }
      if (grupos.length > 1) {
        const titulo = destino.rows[0].cells[0];
        titulo.colSpan = indices.length;
        const ultimoTexto = document.createTreeWalker(titulo, NodeFilter.SHOW_TEXT);
        while (ultimoTexto.nextNode()) {
          const no = ultimoTexto.currentNode;
          no.textContent = (no.textContent || '').replace(/ — parte \d+\/\d+$/, '');
        }
        titulo.append(document.createTextNode(` — parte ${parte + 1}/${grupos.length}`));
        destino.setAttribute('data-tabela-laudo-parte', String(parte + 1));
        tabela.before(destino);
      }
    });
    if (grupos.length > 1) tabela.remove();
  });
  let numero = 1;
  document.querySelectorAll<HTMLTableElement>('table').forEach(tabela => {
    const titulo = tabela.caption ?? tabela.rows[0]?.cells[0];
    const prefixo = titulo && /^(\s*TABELA\s+)\d+\b/i.exec(titulo.textContent || '');
    if (!titulo || !prefixo) return;
    const percurso = document.createTreeWalker(titulo, NodeFilter.SHOW_TEXT);
    const inicioNumero = prefixo[1].length;
    const fimNumero = prefixo[0].length;
    let posicao = 0;
    let inserido = false;
    while (percurso.nextNode()) {
      const no = percurso.currentNode;
      const texto = no.textContent || '';
      const inicio = Math.max(0, inicioNumero - posicao);
      const fim = Math.min(texto.length, fimNumero - posicao);
      if (inicio < fim) {
        no.textContent = texto.slice(0, inicio) + (inserido ? '' : String(numero)) + texto.slice(fim);
        inserido = true;
      }
      posicao += texto.length;
      if (posicao >= fimNumero) break;
    }
    numero += 1;
  });
}

export function criarScriptLayoutTabelas(larguraCm: number): string {
  return `(() => {
    const planejarGruposColunas = ${planejarGruposColunas.toString()};
    const distribuirLargurasColunas = ${distribuirLargurasColunas.toString()};
    const pesoColunaTabela = ${pesoColunaTabela.toString()};
    (${ajustarTabelasDocumento.toString()})(${larguraCm * 96 / 2.54});
  })()`;
}
