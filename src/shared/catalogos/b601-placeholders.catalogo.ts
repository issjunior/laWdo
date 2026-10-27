import { CATALOGO_TIPOS_PECA_B601 } from './b601.catalogo.js'

const CAMPOS_COMUNS = [
  ['numero', 'Número do item'],
  ['natureza', 'Natureza'],
  ['letra', 'Letra da peça'], ['tipo', 'Tipo da peça'], ['identificacao', 'Identificação'],
  ['quantidade', 'Quantidade'], ['medida', 'Medida'], ['quantidade_descricao', 'Descrição da quantidade'],
  ['lacre_entrada', 'Lacre de entrada'], ['lacre_saida', 'Lacre de saída'],
  ['data_entrada', 'Data de entrada'], ['data_liberacao', 'Data de liberação'],
  ['codigo_vestigio', 'Código do vestígio'], ['observacao', 'Observação'],
]
export const CAMPOS_PECA_PLACEHOLDERS_B601 = Array.from(new Map([
  ...CAMPOS_COMUNS,
  ...CATALOGO_TIPOS_PECA_B601.flatMap(tipo => tipo.campos.map(campo => [campo.id.split(':')[1], campo.label])),
].map(([chave, label]) => [chave, { chave, label: chave === 'calibre_nominal' ? 'Calibre nominal' : label }])).values())

export const PLACEHOLDERS_B601 = [
  ...[
    ['tabela_dados_investigacao', 'Tabela dos dados de investigação'], ['tabela_material_enc', 'Tabela de material encaminhado'],
    ['tabela_material_coleta', 'Tabela de material e exames de coleta (Local com Necropsia)'],
    ['resumo_lacres_saida', 'Resumo dos lacres de saída'],
    ['envolvidos', 'Envolvidos'], ['data_ocorrencia', 'Data da ocorrência'], ['local', 'Local'],
    ['numero_bo', 'Número do BO'], ['numero_ip', 'Número do IP'], ['solicitante_nome', 'Unidade policial'],
  ].map(([chave, label]) => ({ chave: `b601_${chave}`, label })),
  ...CAMPOS_PECA_PLACEHOLDERS_B601.map(campo => ({ chave: `b601_peca_N_${campo.chave}`, label: campo.label })),
].map(campo => ({
  ...campo, descricao: `${campo.label} (B-601)`, categoria_exam_codigo: 'B-601', computed: true as const,
}))
