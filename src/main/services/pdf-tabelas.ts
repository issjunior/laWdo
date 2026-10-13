export const ESTILOS_TABELAS_PLACEHOLDER_PDF = `
  table:has([data-placeholder-celula-fixa]) {
    table-layout: fixed;
    width: 100% !important;
    max-width: 100% !important;
  }
  table:has([data-placeholder-celula-fixa]) th,
  table:has([data-placeholder-celula-fixa]) td {
    padding: 4px 3px !important;
    overflow-wrap: anywhere !important;
    white-space: normal !important;
  }
  table:has([data-placeholder-celula-fixa]):has(tr > :nth-child(10)) th,
  table:has([data-placeholder-celula-fixa]):has(tr > :nth-child(10)) td {
    font-size: 10px !important;
    line-height: 1.3;
  }
`;
