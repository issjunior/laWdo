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
  familia: 'arma' | 'componente' | 'componente_balistico' | 'generico'
  schemaVisualConfirmadoProducao: boolean
  dataVerificacaoVisualProducao?: string
  roundTripApiConfirmadoProducao: boolean
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

const CONFIRMACAO_VISUAL_PRODUCAO = {
  schemaVisualConfirmadoProducao: true,
  dataVerificacaoVisualProducao: '2026-08-22',
  roundTripApiConfirmadoProducao: false,
} as const

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
  ['103', 'Alemã'], ['61', 'argentina'], ['62', 'austríaca'], ['104', 'Belga'],
  ['63', 'brasileira'], ['64', 'canadense'], ['105', 'Chinesa'], ['66', 'czechoslovakia'],
  ['67', 'espanhola'], ['106', 'Estadunidense'], ['68', 'filipena'], ['69', 'finlandesa'],
  ['107', 'Francesa'], ['108', 'Israelense'], ['70', 'italiana'], ['71', 'mexicana'],
  ['10', 'Não Aparente'], ['109', 'Russa'], ['65', 'sul-coreana'], ['110', 'Turca'],
].map(([codigo, label]) => ({ codigo, label }))

const opcoesArmaInstitucional: OpcaoCampoB602[] = [
  { codigo: '60', label: 'Indeterminado' },
  { codigo: '98', label: 'Não' },
  { codigo: '97', label: 'Sim' },
]

const opcoesOrigemColeta: OpcaoCampoB602[] = [
  { codigo: '95', label: 'DELEGACIA' },
  { codigo: '1471', label: 'HOSPITAL' },
  { codigo: '93', label: 'LOCAL DE CRIME' },
  { codigo: '94', label: 'NECRÓPSIA' },
  { codigo: '11', label: 'Outro' },
]

const campoOrigemColeta = (
  codigo: string,
  mapeamentoApiConfirmado: boolean = false,
): CampoPersonalizadoB602 => ({
  id: `${codigo}:origem_coleta`,
  chaveGdl: 'ORIGEM/COLETA',
  label: 'ORIGEM/COLETA',
  controle: 'select',
  obrigatorio: true,
  mapeamentoApiConfirmado,
  opcoes: opcoesOrigemColeta,
})

const opcoesMarcaCartucho: OpcaoCampoB602[] = [
  ['12', 'Aguila'], ['1', 'CBC'], ['15', 'Federal'], ['18', 'FMFLB'], ['10', 'Não Aparente'],
  ['17', 'PMC'], ['13', 'S&B'], ['14', 'SP'], ['16', 'Winchester'],
].map(([codigo, label]) => ({ codigo, label }))

const opcoesCalibreNominalCartucho: OpcaoCampoB602[] = [
  ['24', '.22 Curto'], ['23', '.22LR'], ['42', '.25ACP'], ['37', '.32ACP'], ['25', '.32S&W'],
  ['48', '.32S&WL'], ['28', '.357 Magnum'], ['38', '.380ACP'], ['26', '.38SPL'], ['40', '.40S&W'],
  ['41', '.45ACP'], ['49', '.9mm Luger'], ['29', '12GA'], ['30', '16GA'], ['31', '20GA'],
  ['32', '24GA'], ['33', '28GA'], ['34', '32GA'], ['35', '36GA'], ['27', '38 Curto'], ['36', '40GA'],
].map(([codigo, label]) => ({ codigo, label }))

const camposCartucho = (): CampoPersonalizadoB602[] => [
  {
    id: '17:marca_cartucho', chaveGdl: 'Marca de Cartucho', label: 'Marca de Cartucho',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesMarcaCartucho,
  },
  {
    id: '17:calibre_nominal_cartucho', chaveGdl: 'Calibre Nominal Cartucho', label: 'Calibre Nominal Cartucho',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesCalibreNominalCartucho,
  },
]

const camposMetralhadora = (): CampoPersonalizadoB602[] => [
  ...camposArmaBasicos('480', true, [25, 50, 50]),
  {
    id: '480:marca_arma', chaveGdl: 'Marca da Arma', label: 'Marca da Arma', controle: 'combobox',
    obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: [...OPCOES_MARCA_ARMA_B602],
  },
  {
    id: '480:tipo_acabamento', chaveGdl: 'Tipo Acabamento', label: 'Tipo Acabamento',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesTipoAcabamento,
  },
  {
    id: '480:estado_geral', chaveGdl: 'Estado Geral da Arma', label: 'Estado Geral da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesEstadoGeralArma,
  },
  {
    id: '480:funcionamento', chaveGdl: 'Funcionamento', label: 'Funcionamento',
    controle: 'select', obrigatorio: true, mapeamentoApiConfirmado: true, opcoes: opcoesFuncionamentoArma,
  },
  {
    id: '480:fabricacao_arma', chaveGdl: 'Fabricação da Arma', label: 'Fabricação da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesFabricacao,
  },
  campoArmaInstitucional('480', true),
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
  {
    id: `${codigo}:capacidade`, chaveGdl: 'Capacidade', label: 'Capacidade', controle: 'texto',
    obrigatorio: false, maxLength: 50, mapeamentoApiConfirmado,
  },
  {
    id: `${codigo}:marca_arma`, chaveGdl: 'Marca da Arma', label: 'Marca da Arma', controle: 'combobox',
    obrigatorio: false, mapeamentoApiConfirmado, opcoes: [...OPCOES_MARCA_ARMA_B602],
  },
  {
    id: `${codigo}:status_numero_serie`, chaveGdl: 'Status do Número de Série',
    label: 'Status do Número de Série', controle: 'select', obrigatorio: false,
    mapeamentoApiConfirmado, opcoes: opcoesStatusNumeroSerie,
  },
  {
    id: `${codigo}:tipo_acabamento`, chaveGdl: 'Tipo Acabamento', label: 'Tipo Acabamento',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado, opcoes: opcoesTipoAcabamento,
  },
  {
    id: `${codigo}:estado_geral`, chaveGdl: 'Estado Geral da Arma', label: 'Estado Geral da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado, opcoes: opcoesEstadoGeralArma,
  },
  {
    id: `${codigo}:funcionamento`, chaveGdl: 'Funcionamento', label: 'Funcionamento',
    controle: 'select', obrigatorio: true, mapeamentoApiConfirmado, opcoes: opcoesFuncionamentoArma,
  },
  {
    id: `${codigo}:fabricacao_arma`, chaveGdl: 'Fabricação da Arma', label: 'Fabricação da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado, opcoes: opcoesFabricacao,
  },
  campoArmaInstitucional(codigo, mapeamentoApiConfirmado),
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

const opcoesCalibreNominalRevolver: OpcaoCampoB602[] = [
  { codigo: '24', label: '.22 Curto' },
  { codigo: '23', label: '.22LR' },
  { codigo: '25', label: '.32S&W' },
  { codigo: '28', label: '.357 Magnum' },
  { codigo: '26', label: '.38SPL' },
  { codigo: '27', label: '38 Curto' },
]

const opcoesCalibreNominalEspingarda: OpcaoCampoB602[] = [
  { codigo: '29', label: '12GA' },
  { codigo: '30', label: '16GA' },
  { codigo: '31', label: '20GA' },
  { codigo: '32', label: '24GA' },
  { codigo: '33', label: '28GA' },
  { codigo: '34', label: '32GA' },
  { codigo: '35', label: '36GA' },
  { codigo: '36', label: '40GA' },
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
    id: '104:marca', chaveGdl: 'Marca', label: 'Marca', controle: 'texto',
    obrigatorio: false, maxLength: 50, mapeamentoApiConfirmado: true,
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

const camposRevolver = (): CampoPersonalizadoB602[] => [
  ...camposArmaBasicos('106', true, [25, 50, 50]),
  {
    id: '106:marca_arma', chaveGdl: 'Marca da Arma', label: 'Marca da Arma', controle: 'combobox',
    obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: [...OPCOES_MARCA_ARMA_B602],
  },
  {
    id: '106:status_numero_serie', chaveGdl: 'Status do Número de Série',
    label: 'Status do Número de Série', controle: 'select', obrigatorio: false,
    mapeamentoApiConfirmado: true, opcoes: opcoesStatusNumeroSerie,
  },
  {
    id: '106:calibre_nominal', chaveGdl: 'Calibre Nominal Revolver',
    label: 'Calibre Nominal Revolver', controle: 'select', obrigatorio: false,
    mapeamentoApiConfirmado: true, opcoes: opcoesCalibreNominalRevolver,
  },
  {
    id: '106:tipo_acabamento', chaveGdl: 'Tipo Acabamento', label: 'Tipo Acabamento',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesTipoAcabamento,
  },
  {
    id: '106:estado_geral', chaveGdl: 'Estado Geral da Arma', label: 'Estado Geral da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true,
    opcoes: opcoesEstadoGeralArma,
  },
  {
    id: '106:funcionamento', chaveGdl: 'Funcionamento', label: 'Funcionamento',
    controle: 'select', obrigatorio: true, mapeamentoApiConfirmado: true,
    opcoes: opcoesFuncionamentoArma,
  },
  {
    id: '106:fabricacao_arma', chaveGdl: 'Fabricação da Arma', label: 'Fabricação da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true,
    opcoes: opcoesFabricacao,
  },
  {
    id: '106:tambor', chaveGdl: 'Tambor', label: 'Tambor', controle: 'select',
    obrigatorio: false, mapeamentoApiConfirmado: true,
    opcoes: [
      { codigo: '72', label: 'reversível para a direita' },
      { codigo: '73', label: 'reversível para a esquerda' },
    ],
  },
  campoArmaInstitucional('106', true),
]

const camposEspingarda = (): CampoPersonalizadoB602[] => [
  ...camposArmaBasicos('472', true, [25, 50, 50]),
  {
    id: '472:capacidade', chaveGdl: 'Capacidade', label: 'Capacidade', controle: 'texto',
    obrigatorio: false, maxLength: 50, mapeamentoApiConfirmado: true,
  },
  {
    id: '472:marca_arma', chaveGdl: 'Marca da Arma', label: 'Marca da Arma', controle: 'combobox',
    obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: [...OPCOES_MARCA_ARMA_B602],
  },
  {
    id: '472:status_numero_serie', chaveGdl: 'Status do Número de Série',
    label: 'Status do Número de Série', controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true,
    opcoes: opcoesStatusNumeroSerie,
  },
  {
    id: '472:calibre_nominal', chaveGdl: 'Calibre Nominal Espingarda',
    label: 'Calibre Nominal Espingarda', controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true,
    opcoes: opcoesCalibreNominalEspingarda,
  },
  {
    id: '472:tipo_acabamento', chaveGdl: 'Tipo Acabamento', label: 'Tipo Acabamento',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesTipoAcabamento,
  },
  {
    id: '472:estado_geral', chaveGdl: 'Estado Geral da Arma', label: 'Estado Geral da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesEstadoGeralArma,
  },
  {
    id: '472:funcionamento', chaveGdl: 'Funcionamento', label: 'Funcionamento',
    controle: 'select', obrigatorio: true, mapeamentoApiConfirmado: true, opcoes: opcoesFuncionamentoArma,
  },
  {
    id: '472:fabricacao_arma', chaveGdl: 'Fabricação da Arma', label: 'Fabricação da Arma',
    controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true, opcoes: opcoesFabricacao,
  },
  campoArmaInstitucional('472', true),
]

export const CATALOGO_TIPOS_PECA_B602: TipoPecaB602[] = [
  { codigo: '289', label: 'ARMA(S) DE CHOQUE', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposArmaBasicos('289', true, [25, 50, 50]) },
  { codigo: '613', label: 'ARMA(S) DE PRESSÃO', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposArmaBasicos('613', true, [25, 50, 50]) },
  {
    codigo: '476', label: 'CARABINA(S)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO,
    campos: camposComInstitucional('476', true),
  },
  { codigo: '272', label: 'CARREGADOR(ES)', familia: 'componente', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: [] },
  { codigo: '17', label: 'CARTUCHO(S)', familia: 'componente_balistico', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposCartucho() },
  { codigo: '472', label: 'ESPINGARDA(S)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposEspingarda() },
  { codigo: '473', label: 'ESPOLETA(S)', familia: 'componente', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: [] },
  {
    codigo: '101', label: 'ESTOJO(S)', familia: 'componente_balistico', ...CONFIRMACAO_VISUAL_PRODUCAO,
    campos: [campoOrigemColeta('101', true)],
  },
  { codigo: '477', label: 'FUZIL(IS)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposComInstitucional('477', true) },
  { codigo: '475', label: 'GARRUCHA(S)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposComInstitucional('475', true) },
  { codigo: '714', label: 'JET LOADER', familia: 'componente', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: [] },
  { codigo: '480', label: 'METRALHADORA(S)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposMetralhadora() },
  { codigo: '178', label: 'OUTROS', familia: 'generico', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: [] },
  { codigo: '104', label: 'PISTOLA(S)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposPistola() },
  { codigo: '478', label: 'PISTOLETE(S)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: [] },
  { codigo: '572', label: 'PÓLVORA', familia: 'componente_balistico', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: [] },
  { codigo: '105', label: 'PROJÉTEIS', familia: 'componente_balistico', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: [campoOrigemColeta('105', true)] },
  {
    codigo: '106', label: 'REVÓLVER(ES)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO,
    campos: camposRevolver(),
  },
  { codigo: '479', label: 'SUBMETRALHADORA(S)', familia: 'arma', ...CONFIRMACAO_VISUAL_PRODUCAO, campos: camposComInstitucional('479', true) },
]

export function validarCatalogoTiposPecaB602(
  catalogo: TipoPecaB602[] = CATALOGO_TIPOS_PECA_B602,
): void {
  if (catalogo.length !== 19) {
    throw new Error(`O catálogo B602 deve possuir exatamente 19 tipos; recebeu ${catalogo.length}.`)
  }

  const codigos = new Set<string>()
  const labelsEAliases = new Set<string>()
  for (const tipo of catalogo) {
    if (!tipo.codigo.trim() || tipo.codigo === '0' || codigos.has(tipo.codigo)) {
      throw new Error(`Código de tipo B602 inválido ou duplicado: ${tipo.codigo}.`)
    }
    codigos.add(tipo.codigo)

    for (const label of [tipo.label, ...(tipo.aliasesGdl ?? [])]) {
      const normalizado = normalizarIdentificadorCatalogo(label)
      if (!normalizado || labelsEAliases.has(normalizado)) {
        throw new Error(`Label ou alias de tipo B602 inválido ou duplicado: ${label}.`)
      }
      labelsEAliases.add(normalizado)
    }

    const idsCampos = new Set<string>()
    for (const campo of tipo.campos) {
      if (!campo.id.startsWith(`${tipo.codigo}:`) || idsCampos.has(campo.id)) {
        throw new Error(`ID de campo B602 inválido ou duplicado: ${campo.id}.`)
      }
      idsCampos.add(campo.id)

      const codigosOpcoes = new Set<string>()
      for (const opcao of campo.opcoes ?? []) {
        if (!opcao.codigo || opcao.codigo === '0' || codigosOpcoes.has(opcao.codigo)) {
          throw new Error(`Código de opção B602 inválido ou duplicado em ${campo.id}: ${opcao.codigo}.`)
        }
        codigosOpcoes.add(opcao.codigo)
      }
    }
  }
}

function normalizarIdentificadorCatalogo(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
}

validarCatalogoTiposPecaB602()

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
