export type CampoI801 =
  | 'placa' | 'placa_original' | 'placa_aplicada' | 'chassi_aparente'
  | 'chassi_revelado' | 'marca' | 'modelo' | 'prefixo_vtr' | 'cor'
  | 'ano_fabricacao' | 'numero_serie' | 'resultado_psa'

export interface TipoPecaI801 {
  codigo: string
  label: string
  campos: readonly CampoI801[]
}

const veiculoCompleto: CampoI801[] = ['placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo', 'prefixo_vtr', 'cor', 'ano_fabricacao']
const chassi: CampoI801[] = ['chassi_aparente', 'chassi_revelado']
const placaMarcaModelo: CampoI801[] = ['placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo']
const serieMarcaModelo: CampoI801[] = ['numero_serie', 'marca', 'modelo']
const marcaModelo: CampoI801[] = ['marca', 'modelo']

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
  { codigo: 'motor', label: 'MOTOR(ES)', campos: ['chassi_aparente', 'chassi_revelado', 'numero_serie', 'marca', 'modelo'] },
  { codigo: 'motosserra', label: 'MOTOSSERRA(S)', campos: marcaModelo },
  { codigo: 'onibus', label: 'ÔNIBUS', campos: ['placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo', 'cor', 'ano_fabricacao'] },
  { codigo: 'outros', label: 'OUTROS', campos: ['resultado_psa'] },
  { codigo: 'placa_automotiva', label: 'PLACA (AUTOMOTIVA)', campos: ['resultado_psa'] },
  { codigo: 'politriz', label: 'POLITRIZ', campos: [] },
  { codigo: 'quadro_motocicleta', label: 'QUADRO (MOTOCICLETA)', campos: marcaModelo },
  { codigo: 'reboque', label: 'REBOQUE(S)', campos: placaMarcaModelo },
  { codigo: 'rocadeira', label: 'ROÇADEIRA(S)', campos: marcaModelo },
  { codigo: 'segmento_longarina', label: 'SEGMENTO(S) DE LONGARINA', campos: marcaModelo },
  { codigo: 'segmento_monobloco', label: 'SEGMENTO(S) DE MONOBLOCO', campos: ['chassi_aparente', 'chassi_revelado', 'marca', 'modelo'] },
  { codigo: 'semirreboque', label: 'SEMIRREBOQUE(S)', campos: placaMarcaModelo },
  { codigo: 'utilitario', label: 'UTILITÁRIO(S)', campos: ['placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo', 'prefixo_vtr'] },
  { codigo: 'veiculo_aquatico', label: 'VEÍCULO AQUÁTICO', campos: ['placa', 'placa_original', 'placa_aplicada', 'chassi_aparente', 'chassi_revelado', 'marca', 'modelo', 'cor', 'ano_fabricacao'] },
]

export const CAMPOS_I801: Record<CampoI801, string> = {
  placa: 'Placa', placa_original: 'Placa Original', placa_aplicada: 'Placa Aplicada',
  chassi_aparente: 'Chassi Aparente', chassi_revelado: 'Chassi Revelado', marca: 'Marca', modelo: 'Modelo',
  prefixo_vtr: 'Prefixo VTR', cor: 'Cor', ano_fabricacao: 'Ano de Fabricação', numero_serie: 'Nº Série', resultado_psa: 'Resultado PSA',
}

export function normalizarCodigo(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function obterTipoPecaI801PorLabel(label: string): TipoPecaI801 | undefined {
  return CATALOGO_TIPOS_PECA_I801.find(tipo => normalizarCodigo(tipo.label) === normalizarCodigo(label))
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
