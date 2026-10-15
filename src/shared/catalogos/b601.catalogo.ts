import type { CampoPersonalizadoBalistica, PecaBalistica } from '../types/pecas-balistica.types.js'
import { MARCAS_ARMAS_POR_EXAME } from './marcas-armas.catalogo.js'
import {
  opcoesFabricacao, opcoesArmaInstitucional, opcoesOrigemColeta, opcoesMarcaCartucho,
  opcoesCalibreNominalCartucho, opcoesStatusNumeroSerie, opcoesCalibreNominalPistola,
  opcoesCalibreNominalRevolver, opcoesCalibreNominalEspingarda, opcoesTipoAcabamento,
  opcoesEstadoGeralArma, opcoesFuncionamentoArma,
} from './balistica-opcoes.catalogo.js'

export interface TipoPecaB601 {
  codigo: string
  label: string
  campos: CampoPersonalizadoBalistica[]
}

export const OPCOES_UNIDADE_MEDIDA_B601 = [
  { codigo: '1', label: 'HECTARE' }, { codigo: '2', label: 'm2' },
  { codigo: '3', label: 'GRAMAS(g)' }, { codigo: '5', label: 'MILILITROS(ml)' },
  { codigo: '6', label: 'QUILOGRAMAS(Kg)' }, { codigo: '8', label: 'UNIDADES' },
  { codigo: '10', label: 'PORÇÃO' }, { codigo: '11', label: 'AMOSTRA' },
]

// Conferência visual do B601 em 15/10/2026; os nomes da API ainda não foram homologados.
function camposDoTipo(codigo: string): CampoPersonalizadoBalistica[] {
  const texto = (chave: string, label: string, maxLength: number): CampoPersonalizadoBalistica => ({
    id: `${codigo}:${chave}`, chaveGdl: label, label, controle: 'texto', obrigatorio: false, maxLength,
  })
  const selecao = (
    chave: string, label: string, opcoes: CampoPersonalizadoBalistica['opcoes'],
    obrigatorio = false, obrigatorioConclusao = false,
  ): CampoPersonalizadoBalistica => ({
    id: `${codigo}:${chave}`, chaveGdl: label, label, controle: chave === 'marca_arma' ? 'combobox' : 'select',
    obrigatorio, obrigatorioConclusao, opcoes,
  })
  const basicos = () => [texto('numero_serie', 'Nº Série', 25), texto('marca', 'Marca', 50), texto('modelo', 'Modelo', 50)]
  if (['98', '481', '289', '613', '118'].includes(codigo)) return basicos()
  if (codigo === '780') return [selecao('material_biologico', 'Este vestígio pode conter material biológico da vítima?', [
    { codigo: '98', label: 'NÃO' }, { codigo: '97', label: 'SIM' },
  ], true)]
  if (codigo === '178') return [selecao('resultado_psa', 'Resultado PSA', [
    { codigo: '1473', label: 'NEGATIVO' }, { codigo: '1472', label: 'POSITIVO' }, { codigo: '1475', label: 'POSITIVO FRACO' },
  ])]
  if (['101', '105'].includes(codigo)) return [selecao('origem_coleta', 'ORIGEM/COLETA', opcoesOrigemColeta, true)]
  if (codigo === '17') return [
    selecao('marca_cartucho', 'Marca de Cartucho', opcoesMarcaCartucho),
    selecao('calibre_nominal_cartucho', 'Calibre Nominal Cartucho', opcoesCalibreNominalCartucho),
  ]
  if (['218', '265'].includes(codigo)) return [
    texto('marca', 'Marca', 50), texto('modelo', 'Modelo', 50), texto('lamina', 'Lâmina', 22),
    texto('gume', 'Gume', 25), texto('ponta', 'Ponta', 25), texto('composicao_cabo', 'Composição do cabo', 25),
    texto('cor_cabo', 'Cor do cabo', 25), texto('comprimento_lamina', 'Comprimento da lâmina (cm)', 6),
    texto('largura_lamina', 'Largura máxima da lâmina (cm)', 6), texto('comprimento_total', 'Comprimento total (cm)', 6),
  ]
  if (!['476', '472', '477', '475', '480', '104', '106', '479'].includes(codigo)) return []
  const campos = basicos()
  if (!['106', '480'].includes(codigo)) campos.push(texto('capacidade', 'Capacidade', 50))
  campos.push(selecao('marca_arma', 'Marca da Arma', MARCAS_ARMAS_POR_EXAME['B-601']))
  if (codigo !== '480') campos.push(selecao('status_numero_serie', 'Status do Número de Série', opcoesStatusNumeroSerie))
  if (codigo === '472') campos.push(selecao('calibre_nominal', 'Calibre Nominal Espingarda', opcoesCalibreNominalEspingarda))
  if (codigo === '104') campos.push(selecao('calibre_nominal', 'Calibre Nominal Pistola', opcoesCalibreNominalPistola))
  if (codigo === '106') campos.push(selecao('calibre_nominal', 'Calibre Nominal Revolver', opcoesCalibreNominalRevolver))
  campos.push(
    selecao('tipo_acabamento', 'Tipo Acabamento', opcoesTipoAcabamento),
    selecao('estado_geral', 'Estado Geral da Arma', opcoesEstadoGeralArma),
    selecao('funcionamento', 'Funcionamento', opcoesFuncionamentoArma, false, true),
    selecao('fabricacao_arma', 'Fabricação da Arma', opcoesFabricacao),
  )
  if (codigo === '106') campos.push(selecao('tambor', 'Tambor', [
    { codigo: '72', label: 'reversível para a direita' }, { codigo: '73', label: 'reversível para a esquerda' },
  ]))
  campos.push(selecao('arma_institucional', 'Arma é Institucional?', opcoesArmaInstitucional, true))
  return campos
}

const TIPOS_B601: Array<[string, string]> = [
  ["98","ACESSÓRIO(S) PARA ARMA(S)"],
  ["180","ALGEMAS, PRESILHAS E AFINS"],
  ["780","ARMA BRANCA, IMPRÓPRIA OU FERRAMENTA"],
  ["148","ARMA(S) BRANCA(S)"],
  ["481","ARMA(S) DE BRINQUEDO"],
  ["289","ARMA(S) DE CHOQUE"],
  ["613","ARMA(S) DE PRESSÃO"],
  ["656","BAIONETA(S)"],
  ["263","CANIVETE(S)"],
  ["156","CAPACETE(S)"],
  ["476","CARABINA(S)"],
  ["272","CARREGADOR(ES)"],
  ["17","CARTUCHO(S)"],
  ["571","CHUMBO"],
  ["657","CIMITARRA(S)"],
  ["118","COLETES BALÍSTICOS"],
  ["264","CUTELO(S)"],
  ["260","ENXADA(S)"],
  ["655","ESPADA(S)"],
  ["472","ESPINGARDA(S)"],
  ["473","ESPOLETA(S)"],
  ["262","ESTILETE(S)"],
  ["101","ESTOJO(S)"],
  ["218","FACA(S)"],
  ["265","FACÃO(ÕES)"],
  ["477","FUZIL(IS)"],
  ["475","GARRUCHA(S)"],
  ["714","JET LOADER"],
  ["261","LAMINA(S) (GILLETE)"],
  ["267","MACHADINHA(S)"],
  ["266","MACHADO(S)"],
  ["195","MADEIRA(S)"],
  ["168","METAL (BARRA, VIGA, ETC)"],
  ["480","METRALHADORA(S)"],
  ["178","OUTROS"],
  ["287","PÁ(S)"],
  ["390","PICARETA(S)"],
  ["104","PISTOLA(S)"],
  ["478","PISTOLETE(S)"],
  ["572","PÓLVORA"],
  ["105","PROJÉTEIS"],
  ["658","PUNHAL(IS)"],
  ["106","REVÓLVER(ES)"],
  ["474","SIMULACRO(S)"],
  ["268","SOCO INGLÊS"],
  ["479","SUBMETRALHADORA(S)"],
  ["284","TESOURA(S)"],
  ["608","VESTES"],
]

export const CATALOGO_TIPOS_PECA_B601: TipoPecaB601[] = TIPOS_B601.map(([codigo, label]) => ({
  codigo, label, campos: camposDoTipo(codigo),
}))
export const TIPOS_PECA_B601_POR_CODIGO = new Map(CATALOGO_TIPOS_PECA_B601.map(tipo => [tipo.codigo, tipo]))

export function obterPendenciaPecaB601(peca: PecaBalistica): string | null {
  const tipo = TIPOS_PECA_B601_POR_CODIGO.get(peca.tipoCodigo)
  if (!tipo) return 'Selecione um tipo de peça válido.'
  if (!Number.isFinite(peca.comuns.quantidade) || peca.comuns.quantidade <= 0) return 'A quantidade deve ser maior que zero.'
  if (!OPCOES_UNIDADE_MEDIDA_B601.some(opcao => opcao.label === peca.comuns.unidadeMedida)) return 'Selecione uma medida válida.'
  if (peca.comuns.unidadeMedida === 'UNIDADES' && !Number.isInteger(peca.comuns.quantidade)) return 'A quantidade em UNIDADES deve ser inteira.'
  for (const campo of tipo.campos) {
    const valor = peca.personalizados[campo.id]
    if (campo.obrigatorio && (typeof valor !== 'string' || !valor.trim())) return `${campo.label} é obrigatório.`
    if (typeof valor === 'string' && valor && campo.opcoes && campo.controle !== 'combobox'
      && !campo.opcoes.some(opcao => opcao.codigo === valor)) return `Selecione um valor válido para ${campo.label}.`
    if (typeof valor === 'string' && campo.maxLength && valor.length > campo.maxLength) return `${campo.label} excede ${campo.maxLength} caracteres.`
  }
  return null
}
