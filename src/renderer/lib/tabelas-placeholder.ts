const TABLE_STYLES = {
  table:  { borderCollapse: 'collapse', width: '100%', margin: '8px 0' },
  title:  { background: '#d9d9d9', color: '#000', fontWeight: 'bold', textAlign: 'center' as const },
  th:     { border: '1px solid #000', padding: '6px 10px', textAlign: 'center' as const, fontWeight: '600', background: '#e8e8e8', color: '#000', fontSize: '12px' },
  td:     { border: '1px solid #000', padding: '6px 10px', fontSize: '12px', color: '#000' },
  item:   { width: '50px', textAlign: 'center' as const },
} as const;

function style(obj: Record<string, string>): string {
  return Object.entries(obj).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';');
}

export function buildNumberedTable(titulo: string, headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';

  const allHeaders = ['Item', ...headers];
  const colCount = allHeaders.length;
  const theadRow = `<tr>${allHeaders.map(h => `<th style="${style(TABLE_STYLES.th)}">${h}</th>`).join('')}</tr>`;

  const tbodyRows = rows.map((row, i) => {
    const cells = [
      `<td style="${style({ ...TABLE_STYLES.td, ...TABLE_STYLES.item })};">${i + 1}</td>`,
      ...row.map(cell => {
        const val = (cell ?? '').trim() === '' ? '-' : cell;
        return `<td style="${style(TABLE_STYLES.td)}">${val}</td>`;
      }),
    ].join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const titleRow = `<tr><td colspan="${colCount}" style="${style({ ...TABLE_STYLES.th, ...TABLE_STYLES.title })};border:1px solid #000;padding:6px 10px">${titulo}</td></tr>`;

  return `<table style="${style(TABLE_STYLES.table)}"><thead>${titleRow}${theadRow}</thead><tbody>${tbodyRows}</tbody></table>`;
}

export function buildDadosInvestigacaoTable(b602: Record<string, unknown>, solicitanteNome?: string): string {
  const envolvidos = (b602.envolvidos as string[] | undefined)?.filter(Boolean) ?? [];
  const dataOcorrencia = String(b602.data_ocorrencia || '-');
  const localObj = (b602.local && typeof b602.local === 'object' ? b602.local : null) as Record<string, string> | null;
  const local = localObj
    ? [localObj.bairro, localObj.cidade, localObj.uf].filter(Boolean).join(' / ') || '-'
    : String(b602.local || '-');
  const numeroBo = String(b602.numero_bo || '-');
  const numeroIp = String(b602.numero_ip || '-');
  const unidadePolicial = solicitanteNome || String(b602.solicitante_nome || '-');

  const s = TABLE_STYLES;

  const titleRow = `<tr><td colspan="4" style="${style({ ...s.th, ...s.title })};border:1px solid #000;padding:6px 10px">TABELA 1 – DADOS DA INVESTIGAÇÃO</td></tr>`;

  const cell = (val: string, w?: string, extra?: string) =>
    `<td style="${style(s.td)}${w ? ';width:' + w : ''}${extra ? ';' + extra : ''}">${val}</td>`;

  const labelCell = (val: string, w?: string) =>
    `<td style="${style({ ...s.td, fontWeight: '600' })}${w ? ';width:' + w : ''}">${val}</td>`;

  const envolvidosVal = envolvidos.length > 0 ? envolvidos.join(', ') : '-';

  const rows = [
    titleRow,
    `<tr>${labelCell('Envolvido(s):', '25%')}<td colspan="3" style="${style(s.td)}">${envolvidosVal}</td></tr>`,
    `<tr>${labelCell('Data da Ocorrência:', '25%')}${cell(dataOcorrencia, '25%')}${labelCell('Local:', '25%')}${cell(local, '25%')}</tr>`,
    `<tr>${labelCell('Boletim de Ocorrência:', '25%')}${cell(numeroBo, '25%')}${labelCell('Nº do IP:', '25%')}${cell(numeroIp, '25%')}</tr>`,
    `<tr><td colspan="1" style="${style({ ...s.td, fontWeight: '600' })};width:25%">Unidade Policial:</td><td colspan="3" style="${style(s.td)};width:75%">${unidadePolicial}</td></tr>`,
  ];

  return `<table style="${style(s.table)}">${rows.join('')}</table>`;
}

export function buildArmasTabela(b602: Record<string, unknown>, _solicitanteNome?: string): string {
  const armas = (b602.armas as Record<string, unknown>[] | undefined) ?? [];
  if (armas.length === 0) return '';

  const s = TABLE_STYLES;

  const titleRow = `<tr><td colspan="14" style="${style({ ...s.th, ...s.title })};border:1px solid #000;padding:6px 10px">TABELA 5 – ARMAS</td></tr>`;

  const headers = ['Item', 'Tipo', 'Marca', 'Calibre', 'Nº Série', 'Nº Cano',
    'Cap. Carreg.', 'Compr. Cano', 'Acabamento', 'Funcionamento',
    'Est. Conservação', 'Qtd', 'Dito Ofício', 'Nº Lacre'];

  const celula = (val: string, extra?: string) =>
    `<td style="${style(s.td)}${extra ? ';' + extra : ''}">${val || '-'}</td>`;

  const theadRow = `<tr>${headers.map((h) =>
    `<th style="${style(s.th)}">${h}</th>`
  ).join('')}</tr>`;

  const tbodyRows = armas.map((arma, i) => {
    const cells = [
      celula(String(i + 1), 'text-align:center;width:40px'),
      celula(String(arma.tipo || '-')),
      celula(String(arma.marca || '-')),
      celula(String(arma.calibre || '-')),
      celula(String(arma.numeracao_serie || '-')),
      celula(String(arma.numeracao_cano || '-')),
      celula(String(arma.capacidade_carregador || '-')),
      celula(String(arma.comprimento_cano || '-')),
      celula(String(arma.acabamento || '-')),
      celula(String(arma.funcionamento || '-')),
      celula(String(arma.estado_conservacao || '-')),
      celula(String(arma.quantidade || '-')),
      celula(String(arma.dito_oficio || '-')),
      celula(String(arma.numero_lacre || '-')),
    ].join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table style="${style(s.table)}"><thead>${titleRow}${theadRow}</thead><tbody>${tbodyRows}</tbody></table>`;
}
