import type { OpcaoCampoBalistica } from '../types/pecas-balistica.types.js'

export const opcoesFabricacao: OpcaoCampoBalistica[] = [
  ['103', 'Alemã'], ['61', 'argentina'], ['62', 'austríaca'], ['104', 'Belga'],
  ['63', 'brasileira'], ['64', 'canadense'], ['105', 'Chinesa'], ['66', 'czechoslovakia'],
  ['67', 'espanhola'], ['106', 'Estadunidense'], ['68', 'filipena'], ['69', 'finlandesa'],
  ['107', 'Francesa'], ['108', 'Israelense'], ['70', 'italiana'], ['71', 'mexicana'],
  ['10', 'Não Aparente'], ['109', 'Russa'], ['65', 'sul-coreana'], ['110', 'Turca'],
].map(([codigo, label]) => ({ codigo, label }))

export const opcoesArmaInstitucional: OpcaoCampoBalistica[] = [
  { codigo: '60', label: 'Indeterminado' },
  { codigo: '98', label: 'Não' },
  { codigo: '97', label: 'Sim' },
]

export const opcoesOrigemColeta: OpcaoCampoBalistica[] = [
  { codigo: '95', label: 'DELEGACIA' },
  { codigo: '1471', label: 'HOSPITAL' },
  { codigo: '93', label: 'LOCAL DE CRIME' },
  { codigo: '94', label: 'NECRÓPSIA' },
  { codigo: '11', label: 'Outro' },
]

export const opcoesMarcaCartucho: OpcaoCampoBalistica[] = [
  ['12', 'Aguila'], ['1', 'CBC'], ['15', 'Federal'], ['18', 'FMFLB'], ['10', 'Não Aparente'],
  ['17', 'PMC'], ['13', 'S&B'], ['14', 'SP'], ['16', 'Winchester'],
].map(([codigo, label]) => ({ codigo, label }))

export const opcoesCalibreNominalCartucho: OpcaoCampoBalistica[] = [
  ['24', '.22 Curto'], ['23', '.22LR'], ['42', '.25ACP'], ['37', '.32ACP'], ['25', '.32S&W'],
  ['48', '.32S&WL'], ['28', '.357 Magnum'], ['38', '.380ACP'], ['26', '.38SPL'], ['40', '.40S&W'],
  ['41', '.45ACP'], ['49', '.9mm Luger'], ['29', '12GA'], ['30', '16GA'], ['31', '20GA'],
  ['32', '24GA'], ['33', '28GA'], ['34', '32GA'], ['35', '36GA'], ['27', '38 Curto'], ['36', '40GA'],
].map(([codigo, label]) => ({ codigo, label }))

export const opcoesStatusNumeroSerie: OpcaoCampoBalistica[] = [
  { codigo: '19', label: 'Ilegível' },
  { codigo: '20', label: 'Legível' },
  { codigo: '10', label: 'Não Aparente' },
  { codigo: '22', label: 'Revelado' },
  { codigo: '21', label: 'Suprimido intencionalmente' },
]

export const opcoesCalibreNominalPistola: OpcaoCampoBalistica[] = [
  { codigo: '23', label: '.22LR' },
  { codigo: '42', label: '.25ACP' },
  { codigo: '37', label: '.32ACP' },
  { codigo: '38', label: '.380ACP' },
  { codigo: '40', label: '.40S&W' },
  { codigo: '41', label: '.45ACP' },
  { codigo: '39', label: '9mm Luger' },
]

export const opcoesCalibreNominalRevolver: OpcaoCampoBalistica[] = [
  { codigo: '24', label: '.22 Curto' },
  { codigo: '23', label: '.22LR' },
  { codigo: '25', label: '.32S&W' },
  { codigo: '28', label: '.357 Magnum' },
  { codigo: '26', label: '.38SPL' },
  { codigo: '27', label: '38 Curto' },
]

export const opcoesCalibreNominalEspingarda: OpcaoCampoBalistica[] = [
  { codigo: '29', label: '12GA' },
  { codigo: '30', label: '16GA' },
  { codigo: '31', label: '20GA' },
  { codigo: '32', label: '24GA' },
  { codigo: '33', label: '28GA' },
  { codigo: '34', label: '32GA' },
  { codigo: '35', label: '36GA' },
  { codigo: '36', label: '40GA' },
]

export const opcoesTipoAcabamento: OpcaoCampoBalistica[] = [
  { codigo: '44', label: 'Cromado' },
  { codigo: '43', label: 'Desprovido' },
  { codigo: '45', label: 'Emborrachado' },
  { codigo: '46', label: 'Niquelado' },
  { codigo: '47', label: 'Oxidado' },
]

export const opcoesEstadoGeralArma: OpcaoCampoBalistica[] = [
  { codigo: '54', label: 'Bom' },
  { codigo: '53', label: 'Regular' },
  { codigo: '55', label: 'Ruim' },
]

export const opcoesFuncionamentoArma: OpcaoCampoBalistica[] = [
  { codigo: '57', label: 'Eficiente' },
  { codigo: '56', label: 'Ineficiente' },
  { codigo: '100', label: 'NÃO TESTADO' },
]

