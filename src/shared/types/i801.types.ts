export type ResultadoPsaI801 = 'negativo' | 'positivo' | 'positivo_fraco'

import type { CamposComunsPecaBalistica, PecaBalistica } from './pecas-balistica.types.js'

export interface CamposComunsPecaI801 extends CamposComunsPecaBalistica {
  identificacao: string
  numeroAnalises: number
  quantidade: number
  unidadeMedida: string
  quantidadeDescricao: string
  examinadoInLoco: boolean
  dataEntrada: string
  lacreEntrada: string
  lacreSaida: string
  dataLiberacao: string
  codigoVestigio: string
  consumida: 'S' | 'N' | 'P'
  observacao: string
}

export interface PecaI801 extends Omit<PecaBalistica, 'comuns' | 'personalizados'> {
  comuns: CamposComunsPecaI801
  personalizados: Record<string, string | ResultadoPsaI801>
}

export interface DadosI801 {
  pecas: PecaI801[]
}
