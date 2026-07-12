export interface OpcaoCampoB602 {
  codigo: string
  label: string
}

export interface CampoPersonalizadoB602 {
  id: string
  chaveGdl: string
  aliasesGdl?: string[]
  label: string
  controle: 'texto' | 'select'
  obrigatorio: boolean
  mapeamentoApiConfirmado?: boolean
  opcoes?: OpcaoCampoB602[]
}

export interface TipoPecaB602 {
  codigo: string
  label: string
  aliasesGdl?: string[]
  familia: 'arma' | 'componente' | 'componente_balistico' | 'generico' | 'homologacao'
  roundTripConfirmado: boolean
  campos: CampoPersonalizadoB602[]
}

const camposArmaBasicos = (
  codigo: string,
  mapeamentoApiConfirmado: boolean = false,
): CampoPersonalizadoB602[] => [
  {
    id: `${codigo}:numero_serie`,
    chaveGdl: 'Nº Série',
    label: 'Nº Série',
    controle: 'texto',
    obrigatorio: false,
    mapeamentoApiConfirmado,
  },
  {
    id: `${codigo}:marca`,
    chaveGdl: 'Marca',
    label: 'Marca',
    controle: 'texto',
    obrigatorio: false,
    mapeamentoApiConfirmado,
  },
  {
    id: `${codigo}:modelo`,
    chaveGdl: 'Modelo',
    label: 'Modelo',
    controle: 'texto',
    obrigatorio: false,
    mapeamentoApiConfirmado,
  },
]

const opcoesFabricacao: OpcaoCampoB602[] = [
  ['61', 'argentina'], ['62', 'austríaca'], ['63', 'brasileira'], ['64', 'canadense'],
  ['66', 'czechoslovakia'], ['67', 'espanhola'], ['68', 'filipena'], ['69', 'finlandesa'],
  ['70', 'italiana'], ['71', 'mexicana'], ['10', 'Não Aparente'], ['65', 'sul-coreana'],
].map(([codigo, label]) => ({ codigo, label }))

const camposComFabricacao = (codigo: string): CampoPersonalizadoB602[] => [
  ...camposArmaBasicos(codigo),
  {
    id: `${codigo}:fabricacao_arma`,
    chaveGdl: 'Fabricação da Arma',
    label: 'Fabricação da Arma',
    controle: 'select',
    obrigatorio: false,
    opcoes: opcoesFabricacao,
  },
]

export const CATALOGO_TIPOS_PECA_B602: TipoPecaB602[] = [
  { codigo: '289', label: 'ARMA(S) DE CHOQUE', familia: 'arma', roundTripConfirmado: false, campos: camposArmaBasicos('289') },
  { codigo: '613', label: 'ARMA(S) DE PRESSÃO', familia: 'arma', roundTripConfirmado: false, campos: camposArmaBasicos('613') },
  {
    codigo: '476', label: 'CARABINA(S)', familia: 'arma', roundTripConfirmado: true,
    campos: [...camposArmaBasicos('476', true), {
      id: '476:arma_institucional', chaveGdl: 'Arma é Institucional?', label: 'Arma é Institucional?',
      controle: 'select', obrigatorio: true, mapeamentoApiConfirmado: true,
      opcoes: [{ codigo: '60', label: 'Indeterminado' }, { codigo: '98', label: 'NÃO' }, { codigo: '97', label: 'SIM' }],
    }],
  },
  { codigo: '272', label: 'CARREGADOR(ES)', familia: 'componente', roundTripConfirmado: false, campos: camposArmaBasicos('272') },
  { codigo: '472', label: 'ESPINGARDA(S)', familia: 'arma', roundTripConfirmado: false, campos: [] },
  { codigo: '473', label: 'ESPOLETA(S)', familia: 'componente', roundTripConfirmado: false, campos: [] },
  {
    codigo: '101', label: 'ESTOJO(S)', familia: 'componente_balistico', roundTripConfirmado: true,
    campos: [{
      id: '101:origem_coleta', chaveGdl: 'ORIGEM/COLETA', label: 'ORIGEM/COLETA', controle: 'select',
      obrigatorio: true, mapeamentoApiConfirmado: true,
      opcoes: [{ codigo: '95', label: 'DELEGACIA' }, { codigo: '93', label: 'LOCAL DE CRIME' }, { codigo: '94', label: 'NECRÓPSIA' }, { codigo: '11', label: 'Outro' }],
    }],
  },
  { codigo: '477', label: 'FUZIL(IS)', familia: 'arma', roundTripConfirmado: false, campos: [] },
  { codigo: '475', label: 'GARRUCHA(S)', familia: 'arma', roundTripConfirmado: false, campos: [] },
  { codigo: '178', label: 'OUTROS', familia: 'generico', roundTripConfirmado: false, campos: camposComFabricacao('178') },
  { codigo: '771', label: 'PEÇA TESTE', familia: 'homologacao', roundTripConfirmado: false, campos: camposComFabricacao('771') },
  { codigo: '104', label: 'PISTOLA(S)', familia: 'arma', roundTripConfirmado: false, campos: camposComFabricacao('104') },
  { codigo: '478', label: 'PISTOLETE(S)', familia: 'arma', roundTripConfirmado: false, campos: camposComFabricacao('478') },
  { codigo: '572', label: 'PÓLVORA', familia: 'componente_balistico', roundTripConfirmado: false, campos: [] },
  { codigo: '105', label: 'PROJÉTEIS', familia: 'componente_balistico', roundTripConfirmado: false, campos: [] },
  {
    codigo: '106', label: 'REVÓLVER(ES)', familia: 'arma', roundTripConfirmado: false,
    campos: [{
      id: '106:numero_serie', chaveGdl: 'Nº Série', label: 'Nº Série', controle: 'texto',
      obrigatorio: false, mapeamentoApiConfirmado: true,
    }],
  },
  { codigo: '479', label: 'SUBMETRALHADORA(S)', familia: 'arma', roundTripConfirmado: false, campos: [] },
]

function normalizarIdentificadorCatalogo(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
}

export const TIPOS_PECA_B602_POR_CODIGO = new Map(
  CATALOGO_TIPOS_PECA_B602.map(tipo => [tipo.codigo, tipo]),
)

const tiposPecaB602PorLabel = new Map(
  CATALOGO_TIPOS_PECA_B602.flatMap(tipo => (
    [tipo.label, ...(tipo.aliasesGdl ?? [])]
      .map(label => [normalizarIdentificadorCatalogo(label), tipo] as const)
  )),
)

export function obterTipoPecaB602PorLabel(label: string): TipoPecaB602 | undefined {
  return tiposPecaB602PorLabel.get(normalizarIdentificadorCatalogo(label))
}

export function pecaB602EstaCompleta(peca: {
  tipoCodigo: string
  comuns: { quantidade: number }
  personalizados: Record<string, unknown>
}): boolean {
  const tipo = TIPOS_PECA_B602_POR_CODIGO.get(peca.tipoCodigo)
  return !!tipo
    && peca.comuns.quantidade > 0
    && tipo.campos.every(campo => !campo.obrigatorio || !!peca.personalizados[campo.id])
}
