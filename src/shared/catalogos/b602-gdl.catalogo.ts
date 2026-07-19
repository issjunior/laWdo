import { OPCOES_MARCA_ARMA_B602 } from './b602-marcas-armas.catalogo.js'

export interface OpcaoCampoB602 {
  codigo: string
  label: string
}

export interface CampoPersonalizadoB602 {
  id: string
  chaveGdl: string
  aliasesGdl?: string[]
  label: string
  controle: 'texto' | 'select' | 'checkbox' | 'combobox'
  obrigatorio: boolean
  maxLength?: number
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

export const OPCOES_UNIDADE_MEDIDA_B602: OpcaoCampoB602[] = [
  { codigo: '1', label: 'HECTARE' },
  { codigo: '2', label: 'm2' },
  { codigo: '3', label: 'GRAMAS(g)' },
  { codigo: '5', label: 'MILILITROS(ml)' },
  { codigo: '6', label: 'QUILOGRAMAS(Kg)' },
  { codigo: '8', label: 'UNIDADES' },
  { codigo: '10', label: 'PORÇÃO' },
  { codigo: '11', label: 'AMOSTRA' },
]

export const UNIDADE_MEDIDA_PADRAO_B602 = 'UNIDADES'

const camposArmaBasicos = (
  codigo: string,
  mapeamentoApiConfirmado: boolean = false,
  limitesCaracteres?: readonly [numeroSerie: number, marca: number, modelo: number],
): CampoPersonalizadoB602[] => [
  {
    id: `${codigo}:numero_serie`,
    chaveGdl: 'Nº Série',
    label: 'Nº Série',
    controle: 'texto',
    obrigatorio: false,
    maxLength: limitesCaracteres?.[0],
    mapeamentoApiConfirmado,
  },
  {
    id: `${codigo}:marca`,
    chaveGdl: 'Marca',
    label: 'Marca',
    controle: 'texto',
    obrigatorio: false,
    maxLength: limitesCaracteres?.[1],
    mapeamentoApiConfirmado,
  },
  {
    id: `${codigo}:modelo`,
    chaveGdl: 'Modelo',
    label: 'Modelo',
    controle: 'texto',
    obrigatorio: false,
    maxLength: limitesCaracteres?.[2],
    mapeamentoApiConfirmado,
  },
]

const opcoesFabricacao: OpcaoCampoB602[] = [
  ['61', 'argentina'], ['62', 'austríaca'], ['63', 'brasileira'], ['64', 'canadense'],
  ['66', 'czechoslovakia'], ['67', 'espanhola'], ['68', 'filipena'], ['69', 'finlandesa'],
  ['70', 'italiana'], ['71', 'mexicana'], ['10', 'Não Aparente'], ['65', 'sul-coreana'],
].map(([codigo, label]) => ({ codigo, label }))

const opcoesArmaInstitucional: OpcaoCampoB602[] = [
  { codigo: '60', label: 'Indeterminado' },
  { codigo: '98', label: 'NÃO' },
  { codigo: '97', label: 'SIM' },
]

const campoArmaInstitucional = (
  codigo: string,
  mapeamentoApiConfirmado: boolean = false,
): CampoPersonalizadoB602 => ({
  id: `${codigo}:arma_institucional`,
  chaveGdl: 'Arma é Institucional?',
  label: 'Arma é Institucional?',
  controle: 'checkbox',
  obrigatorio: true,
  mapeamentoApiConfirmado,
  opcoes: opcoesArmaInstitucional,
})

const camposComInstitucional = (
  codigo: string,
  mapeamentoApiConfirmado: boolean = false,
): CampoPersonalizadoB602[] => [
  ...camposArmaBasicos(codigo, mapeamentoApiConfirmado, [25, 50, 50]),
  campoArmaInstitucional(codigo, mapeamentoApiConfirmado),
]

const camposComFabricacao = (
  codigo: string,
  limitesCaracteres?: readonly [numeroSerie: number, marca: number, modelo: number],
): CampoPersonalizadoB602[] => [
  ...camposArmaBasicos(codigo, false, limitesCaracteres),
  {
    id: `${codigo}:fabricacao_arma`,
    chaveGdl: 'Fabricação da Arma',
    label: 'Fabricação da Arma',
    controle: 'select',
    obrigatorio: false,
    opcoes: opcoesFabricacao,
  },
]

const opcoesStatusNumeroSerie: OpcaoCampoB602[] = [
  { codigo: '19', label: 'Ilegível' },
  { codigo: '20', label: 'Legível' },
  { codigo: '10', label: 'Não Aparente' },
  { codigo: '22', label: 'Revelado' },
  { codigo: '21', label: 'Suprimido intencionalmente' },
]

const opcoesCalibreNominalPistola: OpcaoCampoB602[] = [
  { codigo: '23', label: '.22LR' },
  { codigo: '42', label: '.25ACP' },
  { codigo: '37', label: '.32ACP' },
  { codigo: '38', label: '.380ACP' },
  { codigo: '40', label: '.40S&W' },
  { codigo: '41', label: '.45ACP' },
  { codigo: '39', label: '9mm Luger' },
]

const opcoesTipoAcabamento: OpcaoCampoB602[] = [
  { codigo: '44', label: 'Cromado' },
  { codigo: '43', label: 'Desprovido' },
  { codigo: '45', label: 'Emborrachado' },
  { codigo: '46', label: 'Niquelado' },
  { codigo: '47', label: 'Oxidado' },
]

const opcoesEstadoGeralArma: OpcaoCampoB602[] = [
  { codigo: '54', label: 'Bom' },
  { codigo: '53', label: 'Regular' },
  { codigo: '55', label: 'Ruim' },
]

const opcoesFuncionamentoArma: OpcaoCampoB602[] = [
  { codigo: '57', label: 'Eficiente' },
  { codigo: '56', label: 'Ineficiente' },
  { codigo: '100', label: 'NÃO TESTADO' },
]

const camposPistola = (): CampoPersonalizadoB602[] => [
  {
    id: '104:numero_serie', chaveGdl: 'Nº Série', label: 'Nº Série', controle: 'texto',
    obrigatorio: false, maxLength: 25, mapeamentoApiConfirmado: true,
  },
  {
    id: '104:modelo', chaveGdl: 'Modelo', label: 'Modelo', controle: 'texto',
    obrigatorio: false, maxLength: 50, mapeamentoApiConfirmado: true,
  },
  {
    id: '104:capacidade', chaveGdl: 'Capacidade', label: 'Capacidade', controle: 'texto',
    obrigatorio: false, maxLength: 50, mapeamentoApiConfirmado: true,
  },
  {
    id: '104:marca_arma', chaveGdl: 'Marca da Arma', label: 'Marca da Arma', controle: 'combobox',
    obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: [...OPCOES_MARCA_ARMA_B602],
  },
  {
    id: '104:status_numero_serie', chaveGdl: 'Status do Número de Série',
    label: 'Status do Número de Série', controle: 'select', obrigatorio: false,
    mapeamentoApiConfirmado: true, opcoes: opcoesStatusNumeroSerie,
  },
  {
    id: '104:calibre_nominal', chaveGdl: 'Calibre Nominal Pistola',
    label: 'Calibre Nominal Pistola', controle: 'select', obrigatorio: false,
    mapeamentoApiConfirmado: true, opcoes: opcoesCalibreNominalPistola,
  },
  {
    id: '104:tipo_acabamento', chaveGdl: 'Tipo Acabamento', label: 'Tipo Acabamento',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true,
    opcoes: opcoesTipoAcabamento,
  },
  {
    id: '104:estado_geral', chaveGdl: 'Estado Geral da Arma', label: 'Estado Geral da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true,
    opcoes: opcoesEstadoGeralArma,
  },
  {
    id: '104:funcionamento', chaveGdl: 'Funcionamento', label: 'Funcionamento',
    controle: 'select', obrigatorio: true, mapeamentoApiConfirmado: true,
    opcoes: opcoesFuncionamentoArma,
  },
  {
    id: '104:fabricacao_arma', chaveGdl: 'Fabricação da Arma', label: 'Fabricação da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true,
    opcoes: opcoesFabricacao,
  },
  campoArmaInstitucional('104', true),
]

export const CATALOGO_TIPOS_PECA_B602: TipoPecaB602[] = [
  { codigo: '289', label: 'ARMA(S) DE CHOQUE', familia: 'arma', roundTripConfirmado: false, campos: camposArmaBasicos('289', true, [25, 50, 50]) },
  { codigo: '613', label: 'ARMA(S) DE PRESSÃO', familia: 'arma', roundTripConfirmado: false, campos: camposArmaBasicos('613', false, [25, 50, 50]) },
  {
    codigo: '476', label: 'CARABINA(S)', familia: 'arma', roundTripConfirmado: true,
    campos: camposComInstitucional('476', true),
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
  { codigo: '477', label: 'FUZIL(IS)', familia: 'arma', roundTripConfirmado: false, campos: camposComInstitucional('477') },
  { codigo: '475', label: 'GARRUCHA(S)', familia: 'arma', roundTripConfirmado: false, campos: camposComFabricacao('475', [25, 50, 50]) },
  { codigo: '178', label: 'OUTROS', familia: 'generico', roundTripConfirmado: false, campos: camposComFabricacao('178') },
  { codigo: '771', label: 'PEÇA TESTE', familia: 'homologacao', roundTripConfirmado: false, campos: camposComFabricacao('771') },
  { codigo: '104', label: 'PISTOLA(S)', familia: 'arma', roundTripConfirmado: false, campos: camposPistola() },
  { codigo: '478', label: 'PISTOLETE(S)', familia: 'arma', roundTripConfirmado: false, campos: [] },
  { codigo: '572', label: 'PÓLVORA', familia: 'componente_balistico', roundTripConfirmado: false, campos: [] },
  { codigo: '105', label: 'PROJÉTEIS', familia: 'componente_balistico', roundTripConfirmado: false, campos: [] },
  {
    codigo: '106', label: 'REVÓLVER(ES)', familia: 'arma', roundTripConfirmado: false,
    campos: [{
      id: '106:numero_serie', chaveGdl: 'Nº Série', label: 'Nº Série', controle: 'texto',
      obrigatorio: false, mapeamentoApiConfirmado: true,
    }],
  },
  { codigo: '479', label: 'SUBMETRALHADORA(S)', familia: 'arma', roundTripConfirmado: false, campos: camposComInstitucional('479') },
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
