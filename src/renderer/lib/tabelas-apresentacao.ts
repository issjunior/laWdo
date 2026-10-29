import { ajustarTabelasBalistica } from './tabelas-balistica-layout';

export function normalizarApresentacaoTabelas(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLTableElement>('table:has([data-placeholder-celula-fixa]), [data-placeholder-tabela-personalizada] table, [data-placeholder-preview-tabela] table, [data-b601-grupo] table').forEach(tabela => {
    tabela.style.fontFamily = 'Arial, Helvetica, sans-serif';
  });
  raiz.querySelectorAll<HTMLElement>('[data-b601-grupo]').forEach(grupo => {
    grupo.querySelectorAll<HTMLTableElement>('table').forEach(tabela => {
      tabela.style.fontSize = '12px';
      tabela.setAttribute('data-tabela-laudo', 'balistica');
      tabela.querySelectorAll<HTMLElement>('th, td').forEach(celula => {
        celula.style.textAlign = 'center';
        celula.style.verticalAlign = 'middle';
      });
      if (tabela.closest('[data-b601-fotos-origem]')) {
        [tabela, ...tabela.querySelectorAll<HTMLElement>('thead, tbody, tfoot, tr, th, td')].forEach(elemento => {
          elemento.style.removeProperty('background');
          elemento.style.removeProperty('background-color');
          elemento.removeAttribute('bgcolor');
        });
      } else {
        tabela.querySelectorAll<HTMLElement>('th').forEach(celula => {
          celula.style.backgroundColor = '#e8e8e8';
          celula.style.color = '#000';
        });
        tabela.querySelectorAll<HTMLElement>('thead tr:first-child th[colspan]').forEach(titulo => {
          titulo.style.backgroundColor = '#d9d9d9';
        });
      }
      if (grupo.getAttribute('data-b601-grupo') === '105') {
        tabela.querySelectorAll<HTMLElement>('thead th').forEach(celula => {
          const texto = celula.textContent?.trim() || '';
          const identificador = texto.match(/^(PQ\d+)\s*·\s*Item\s+\d+$/)?.[1];
          if (identificador) celula.textContent = identificador;
        });
      }
      if (grupo.getAttribute('data-b601-grupo') === '101') {
        tabela.querySelectorAll<HTMLElement>('tbody tr > td:first-child').forEach(celula => {
          const texto = celula.textContent?.trim() || '';
          const identificador = texto.match(/^(\d+)\s*·\s*Item\s+\d+$/)?.[1];
          if (identificador) celula.textContent = identificador;
        });
      }
    });
  });
  ajustarTabelasBalistica(raiz);
}
