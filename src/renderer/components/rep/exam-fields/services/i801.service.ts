import type { DadosI801, PecaI801 } from '@shared/types/i801.types'
import type { ExamService } from './types'

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function criarDadosI801(): DadosI801 { return { pecas: [] } }

export function lerDadosI801(json: string | null | undefined): { dados: DadosI801; raiz: Record<string, unknown> } {
  if (!json) return { dados: criarDadosI801(), raiz: {} }
  const raiz: unknown = JSON.parse(json)
  if (!ehRegistro(raiz)) throw new Error('O conteúdo específico da REP não é um objeto válido.')
  const i801 = raiz.i801
  if (!ehRegistro(i801) || !Array.isArray(i801.pecas)) return { dados: criarDadosI801(), raiz }
  const pecas = i801.pecas.filter(ehRegistro).filter(peca => typeof peca.idLocal === 'string' && ehRegistro(peca.comuns)) as unknown as PecaI801[]
  return { dados: { pecas }, raiz }
}

export const i801Service: ExamService = {
  codigo: 'I-801',
  serialize(_data, contexto) {
    if (!contexto?.i801) throw new Error('O contexto das peças I-801 não está disponível.')
    return { ...contexto.i801.raiz, i801: contexto.i801.dados }
  },
  deserialize() { return {} },
}
