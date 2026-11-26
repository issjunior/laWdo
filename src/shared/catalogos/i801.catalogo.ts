export type CampoI801 =
  | 'placa' | 'placa_original' | 'placa_aplicada' | 'chassi_aparente'
  | 'chassi_revelado' | 'marca' | 'modelo' | 'prefixo_vtr' | 'cor'
  | 'ano_fabricacao' | 'numero_serie' | 'resultado_psa'

export interface CampoPersonalizadoI801 {
  id: CampoI801
  chaveGdl: string
  aliasesGdl?: readonly string[]
  label: string
  mapeamentoApiConfirmado: boolean
}

export interface TipoPecaI801 {
  codigo: string
  label: string
  campos: readonly CampoPersonalizadoI801[]
}

export const CAMPOS_PERSONALIZADOS_I801: Record<CampoI801, CampoPersonalizadoI801> = {
  placa: { id: 'placa', chaveGdl: 'placa', label: 'Placa', mapeamentoApiConfirmado: false },
  placa_original: { id: 'placa_original', chaveGdl: 'placaOriginal', label: 'Placa Original', mapeamentoApiConfirmado: false },
  placa_aplicada: { id: 'placa_aplicada', chaveGdl: 'placaAplicada', label: 'Placa Aplicada', mapeamentoApiConfirmado: false },
  chassi_aparente: { id: 'chassi_aparente', chaveGdl: 'chassiAparente', label: 'Chassi Aparente', mapeamentoApiConfirmado: false },
  chassi_revelado: { id: 'chassi_revelado', chaveGdl: 'chassiRevelado', label: 'Chassi Revelado', mapeamentoApiConfirmado: false },
  marca: { id: 'marca', chaveGdl: 'marca', label: 'Marca', mapeamentoApiConfirmado: false },
  modelo: { id: 'modelo', chaveGdl: 'modelo', label: 'Modelo', mapeamentoApiConfirmado: false },
  prefixo_vtr: { id: 'prefixo_vtr', chaveGdl: 'prefixoVtr', label: 'Prefixo VTR', mapeamentoApiConfirmado: false },
  cor: { id: 'cor', chaveGdl: 'cor', label: 'Cor', mapeamentoApiConfirmado: false },
  ano_fabricacao: { id: 'ano_fabricacao', chaveGdl: 'anoFabricacao', label: 'Ano de Fabricação', mapeamentoApiConfirmado: false },
  numero_serie: { id: 'numero_serie', chaveGdl: 'numeroSerie', label: 'Nº Série', mapeamentoApiConfirmado: false },
  resultado_psa: { id: 'resultado_psa', chaveGdl: 'resultadoPsa', label: 'Resultado PSA', mapeamentoApiConfirmado: false },
}

function camposI801(...campos: CampoI801[]): CampoPersonalizadoI801[] {
  return campos.map(campo => CAMPOS_PERSONALIZADOS_I801[campo])
}

const veiculoCompleto = camposI801('placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo', 'prefixo_vtr', 'cor', 'ano_fabricacao')
const chassi = camposI801('chassi_aparente', 'chassi_revelado')
const placaMarcaModelo = camposI801('placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo')
const serieMarcaModelo = camposI801('numero_serie', 'marca', 'modelo')
const marcaModelo = camposI801('marca', 'modelo')

export const CATALOGO_TIPOS_PECA_I801: readonly TipoPecaI801[] = [
  { codigo: 'automovel', label: 'AUTOMÓVEL(EIS)', campos: veiculoCompleto },
  { codigo: 'bicicleta', label: 'BICICLETA(S)', campos: serieMarcaModelo },
  { codigo: 'caixa_direcao', label: 'CAIXA DE DIREÇÃO', campos: serieMarcaModelo },
  { codigo: 'caixa_cambio', label: 'CAIXA(S) DE CAMBIO', campos: serieMarcaModelo },
  { codigo: 'caminhao', label: 'CAMINHÃO(ÕES)', campos: veiculoCompleto },
  { codigo: 'caminhonete', label: 'CAMINHONETE(S)', campos: veiculoCompleto },
  { codigo: 'camioneta', label: 'CAMIONETA(S)', campos: veiculoCompleto },
  { codigo: 'carrocaria', label: 'CARROÇARIA(S)', campos: placaMarcaModelo },
  ...['EIXO(S)', 'ESCAVADEIRA(S)', 'ESMERILHADEIRA(S)', 'FURADEIRA(S)', 'LONGARINA', 'MÁQUINA(S) AGRÍCOLA(S)', 'MÓDULO(S) ELETRÔNICO(S)', 'MONOBLOCO(S)', 'MOTOCICLETA(S)'].map(label => ({ codigo: normalizarCodigo(label), label, campos: chassi })),
  { codigo: 'motoneta', label: 'MOTONETA(S)', campos: placaMarcaModelo },
  { codigo: 'motor', label: 'MOTOR(ES)', campos: camposI801('chassi_aparente', 'chassi_revelado', 'numero_serie', 'marca', 'modelo') },
  { codigo: 'motosserra', label: 'MOTOSSERRA(S)', campos: marcaModelo },
  { codigo: 'onibus', label: 'ÔNIBUS', campos: camposI801('placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo', 'cor', 'ano_fabricacao') },
  { codigo: 'outros', label: 'OUTROS', campos: camposI801('resultado_psa') },
  { codigo: 'placa_automotiva', label: 'PLACA (AUTOMOTIVA)', campos: camposI801('resultado_psa') },
  { codigo: 'politriz', label: 'POLITRIZ', campos: [] },
  { codigo: 'quadro_motocicleta', label: 'QUADRO (MOTOCICLETA)', campos: marcaModelo },
  { codigo: 'reboque', label: 'REBOQUE(S)', campos: placaMarcaModelo },
  { codigo: 'rocadeira', label: 'ROÇADEIRA(S)', campos: marcaModelo },
  { codigo: 'segmento_longarina', label: 'SEGMENTO(S) DE LONGARINA', campos: marcaModelo },
  { codigo: 'segmento_monobloco', label: 'SEGMENTO(S) DE MONOBLOCO', campos: camposI801('chassi_aparente', 'chassi_revelado', 'marca', 'modelo') },
  { codigo: 'semirreboque', label: 'SEMIRREBOQUE(S)', campos: placaMarcaModelo },
  { codigo: 'utilitario', label: 'UTILITÁRIO(S)', campos: camposI801('placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo', 'prefixo_vtr') },
  { codigo: 'veiculo_aquatico', label: 'VEÍCULO AQUÁTICO', campos: camposI801('placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo', 'cor', 'ano_fabricacao') },
]

export function normalizarCodigo(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function obterTipoPecaI801PorLabel(label: string): TipoPecaI801 | undefined {
  return CATALOGO_TIPOS_PECA_I801.find(tipo => normalizarCodigo(tipo.label) === normalizarCodigo(label))
}

export function obterTipoPecaI801PorCodigo(codigo: string): TipoPecaI801 | undefined {
  return CATALOGO_TIPOS_PECA_I801.find(tipo => tipo.codigo === codigo)
}

export function obterCampoPersonalizadoI801PorChaveGdl(
  tipo: TipoPecaI801 | undefined,
  chaveGdl: string,
): CampoPersonalizadoI801 | undefined {
  const chaveNormalizada = normalizarCodigo(chaveGdl)
  return tipo?.campos.find(campo => (
    [campo.chaveGdl, ...(campo.aliasesGdl ?? [])]
      .some(alias => normalizarCodigo(alias) === chaveNormalizada)
  ))
}

export function obterPendenciaPecaI801(peca: {
  tipoCodigo: string
  comuns: { unidadeMedida: string; dataEntrada: string }
}): string | undefined {
  if (!peca.tipoCodigo) return 'Tipo do item obrigatório'
  if (!peca.comuns.unidadeMedida.trim()) return 'Medida obrigatória'
  if (!peca.comuns.dataEntrada.trim()) return 'Data de entrada obrigatória'
  return undefined
}
