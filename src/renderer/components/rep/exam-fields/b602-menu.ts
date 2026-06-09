export interface MenuField {
  name: string;
  label: string;
}

export interface MenuGroup {
  type: 'group';
  label: string;
  prefix: string;
  fields: MenuField[];
}

export interface MenuEntry {
  type: 'field';
  name: string;
  label: string;
}

export type MenuSectionItem = MenuEntry | MenuGroup;

export interface MenuSection {
  id: string;
  label: string;
  items: MenuSectionItem[];
}

export const B602_MENU_STRUCTURE: MenuSection[] = [
  {
    id: 'dados_investigacao',
    label: 'Dados da Investigação',
    items: [
      { type: 'field', name: 'b602_tabela_dados_investigacao', label: 'Tabela completa' },
      { type: 'field', name: 'b602_envolvidos', label: 'Envolvidos (todos)' },
      {
        type: 'group',
        label: 'Envolvidos',
        prefix: 'b602_envolvido_',
        fields: [{ name: '', label: 'Nome do envolvido' }],
      },
      { type: 'field', name: 'b602_data_ocorrencia', label: 'Data da Ocorrência' },
      { type: 'field', name: 'b602_local', label: 'Local' },
      { type: 'field', name: 'b602_numero_bo', label: 'Nº do BO' },
      { type: 'field', name: 'b602_numero_ip', label: 'Nº do IP' },
      { type: 'field', name: 'b602_solicitante_nome', label: 'Solicitante' },
    ],
  },
  {
    id: 'material_enc',
    label: 'Material Encaminhado',
    items: [
      { type: 'field', name: 'b602_tabela_material_enc', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Item',
        prefix: 'b602_material_enc_',
        fields: [
          { name: 'natureza', label: 'Natureza' },
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'tipo', label: 'Tipo' },
          { name: 'dito_oficio', label: 'Dito do Ofício' },
          { name: 'numero_lacre', label: 'Nº do Lacre' },
        ],
      },
    ],
  },
  {
    id: 'cartuchos',
    label: 'Cartuchos',
    items: [
      { type: 'field', name: 'b602_tabela_cartuchos', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Cartucho',
        prefix: 'b602_cartucho_',
        fields: [
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'calibre', label: 'Calibre' },
          { name: 'marca', label: 'Marca' },
          { name: 'origem', label: 'Origem' },
          { name: 'espoleta', label: 'Espoleta' },
          { name: 'estojo', label: 'Estojo' },
          { name: 'projetil', label: 'Projétil' },
          { name: 'observacao', label: 'Observação' },
        ],
      },
    ],
  },
  {
    id: 'estojos',
    label: 'Estojos',
    items: [
      { type: 'field', name: 'b602_tabela_estojos', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Estojo',
        prefix: 'b602_estojo_',
        fields: [
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'calibre', label: 'Calibre' },
          { name: 'marca', label: 'Marca' },
          { name: 'origem', label: 'Origem' },
          { name: 'espoleta', label: 'Espoleta' },
          { name: 'estojo', label: 'Estojo' },
          { name: 'observacao', label: 'Observação' },
        ],
      },
    ],
  },
];

export function getGroupCount(prefix: string, b602Data: Record<string, unknown> | undefined): number {
  if (!b602Data) return 0;
  if (prefix === 'b602_envolvido_') {
    const arr = b602Data.envolvidos as unknown[] | undefined;
    return Array.isArray(arr) ? arr.filter(Boolean).length : 0;
  }
  if (prefix === 'b602_material_enc_') {
    const arr = b602Data.material_enc as unknown[] | undefined;
    return Array.isArray(arr) ? arr.length : 0;
  }
  if (prefix === 'b602_cartucho_') {
    const arr = b602Data.cartuchos as unknown[] | undefined;
    return Array.isArray(arr) ? arr.length : 0;
  }
  if (prefix === 'b602_estojo_') {
    const arr = b602Data.estojos as unknown[] | undefined;
    return Array.isArray(arr) ? arr.length : 0;
  }
  return 0;
}
