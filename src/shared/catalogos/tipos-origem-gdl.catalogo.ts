export interface TipoOrigemGdl {
  codigo: string
  label: string
}

/**
 * Catálogo do campo Origens > Tipo do GDL.
 *
 * Os códigos e a ordem refletem o select do GDL consultado em 14/07/2026.
 * A aplicação persiste o label, pois esse é o valor fornecido pela API da REP.
 */
export const CATALOGO_TIPOS_ORIGEM_GDL: readonly TipoOrigemGdl[] = [
  { codigo: '56', label: 'AÇÃO PENAL ORIGINÁRIA' },
  { codigo: '8', label: 'AI' },
  { codigo: '54', label: 'AUTOS DA NOTÍCIA DE FATO' },
  { codigo: '49', label: 'AUTOS DE BUSCA E APREENSÃO' },
  { codigo: '57', label: 'AUTOS DE VERIFICAÇÃO' },
  { codigo: '48', label: 'BATEU' },
  { codigo: '2', label: 'BO' },
  { codigo: '29', label: 'BO/PM' },
  { codigo: '18', label: 'BOC' },
  { codigo: '53', label: 'BOLETIM EM ANÁLISE' },
  { codigo: '45', label: 'CARTA PRECATÓRIA' },
  { codigo: '36', label: 'COMUNICADO' },
  { codigo: '12', label: 'CORREGEDORIA/CIVIL' },
  { codigo: '13', label: 'CORREGEDORIA/PM' },
  { codigo: '51', label: 'DECLARAÇÃO DE ÓBITO' },
  { codigo: '44', label: 'EPROTOCOLO' },
  { codigo: '39', label: 'EXUMAÇÃO' },
  { codigo: '42', label: 'INQUÉRITO CIVIL' },
  { codigo: '6', label: 'IP ONLINE' },
  { codigo: '3', label: 'IP/APFD' },
  { codigo: '4', label: 'IP/PM' },
  { codigo: '58', label: 'IPM/AERONÁUTICA' },
  { codigo: '20', label: 'IPM/EXÉRCITO' },
  { codigo: '38', label: 'IT' },
  { codigo: '69', label: 'LAUDO GSR PF' },
  { codigo: '11', label: 'LAUDO/SAP' },
  { codigo: '52', label: 'LNC' },
  { codigo: '41', label: 'MANDADO' },
  { codigo: '55', label: 'MATCH ID DR' },
  { codigo: '50', label: 'MATCH ID FV' },
  { codigo: '60', label: 'MEDIDA CAUTELAR' },
  { codigo: '59', label: 'MEDIDA PROTETIVA' },
  { codigo: '10', label: 'MOVIMENTAÇÃO' },
  { codigo: '47', label: 'OFÍCIO DE ENCAMINHAMENTO DE MATERIAL PADRÃO' },
  { codigo: '34', label: 'OFÍCIO REITERANDO' },
  { codigo: '28', label: 'OFÍCIO REQUIS. COMPLEM.' },
  { codigo: '9', label: 'OFÍCIO REQUISITANTE' },
  { codigo: '46', label: 'OFÍCIO RETIFICANTE' },
  { codigo: '37', label: 'OFÍCIO SOLICITANDO CÓPIA' },
  { codigo: '32', label: 'PIC' },
  { codigo: '5', label: 'PROCESSO' },
  { codigo: '40', label: 'PROCESSO ADMINISTRATIVO' },
  { codigo: '30', label: 'REP' },
  { codigo: '21', label: 'REQUISIÇÃO CLÍNICA' },
  { codigo: '35', label: 'RIBPG' },
  { codigo: '43', label: 'SINDICÂNCIA' },
  { codigo: '33', label: 'SMAP' },
  { codigo: '31', label: 'SML' },
  { codigo: '7', label: 'TC' },
  { codigo: '66', label: 'TESTE' },
]

export const LABELS_TIPOS_ORIGEM_GDL = CATALOGO_TIPOS_ORIGEM_GDL.map(tipo => tipo.label)
