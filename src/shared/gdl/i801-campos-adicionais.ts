import {
  obterCampoPersonalizadoI801PorChaveGdl,
  type CampoPersonalizadoI801,
  type TipoPecaI801,
} from '../catalogos/i801.catalogo.js'
import type { ResultadoPsaI801 } from '../types/i801.types.js'

export interface CampoAdicionalI801 {
  chave: string
  rotulo: string
  valor: unknown
}

function normalizarChave(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '')
}

export function converterValorPersonalizadoI801(
  campo: CampoPersonalizadoI801,
  valor: unknown,
): string | ResultadoPsaI801 | undefined {
  if (typeof valor !== 'string' && typeof valor !== 'number') return undefined
  const texto = String(valor).trim()
  if (campo.id !== 'resultado_psa') return texto
  if (texto === '') return ''
  const resultado = normalizarChave(texto)
  if (resultado === 'negativo') return 'negativo'
  if (resultado === 'positivo') return 'positivo'
  if (resultado === 'positivofraco') return 'positivo_fraco'
  return undefined
}

export function separarCamposAdicionaisI801(
  dados: Record<string, unknown>,
  tipo?: TipoPecaI801,
  personalizados: Record<string, unknown> = {},
): { revisao: CampoAdicionalI801[]; informativos: CampoAdicionalI801[] } {
  const revisao: CampoAdicionalI801[] = []
  const informativos: CampoAdicionalI801[] = []

  for (const [chave, valor] of Object.entries(dados)) {
    const campo = obterCampoPersonalizadoI801PorChaveGdl(tipo, chave)
    const convertido = campo && campo.mapeamentoApiConfirmado
      ? converterValorPersonalizadoI801(campo, valor)
      : undefined
    const jaPreenchido = campo && convertido !== undefined && personalizados[campo.id] === convertido
    const vazio = valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim())
      || (typeof valor === 'object' && Object.keys(valor).length === 0)
    const adicional = { chave, rotulo: campo?.label ?? chave, valor }
    if (vazio || jaPreenchido) informativos.push(adicional)
    else revisao.push(adicional)
  }

  return { revisao, informativos }
}
