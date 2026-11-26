import type { DadosI801, PecaI801 } from '@shared/types/i801.types'
import type { ExamService } from './types'

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function numero(valor: unknown, padrao: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : padrao
}

function normalizarPecaI801(valor: unknown): PecaI801 | undefined {
  if (!ehRegistro(valor) || typeof valor.idLocal !== 'string' || !ehRegistro(valor.comuns)) return undefined

  const comuns = valor.comuns
  const personalizados: PecaI801['personalizados'] = {}
  if (ehRegistro(valor.personalizados)) {
    for (const [chave, item] of Object.entries(valor.personalizados)) {
      if (typeof item === 'string') personalizados[chave] = item
    }
  }

  return {
    idLocal: valor.idLocal,
    origem: valor.origem === 'gdl' ? 'gdl' : 'manual',
    alteradaLocalmente: valor.alteradaLocalmente === true,
    ...(typeof valor.codPecaGdl === 'number' && Number.isFinite(valor.codPecaGdl) ? { codPecaGdl: valor.codPecaGdl } : {}),
    tipoCodigo: texto(valor.tipoCodigo),
    tipoPeca: texto(valor.tipoPeca),
    comuns: {
      identificacao: texto(comuns.identificacao),
      numeroAnalises: Math.max(1, Math.trunc(numero(comuns.numeroAnalises, 1))),
      quantidade: numero(comuns.quantidade, 0),
      unidadeMedida: texto(comuns.unidadeMedida),
      quantidadeDescricao: texto(comuns.quantidadeDescricao),
      examinadoInLoco: comuns.examinadoInLoco === true,
      dataEntrada: texto(comuns.dataEntrada),
      lacreEntrada: texto(comuns.lacreEntrada),
      lacreSaida: texto(comuns.lacreSaida),
      dataLiberacao: texto(comuns.dataLiberacao),
      codigoVestigio: texto(comuns.codigoVestigio),
      consumida: comuns.consumida === 'S' || comuns.consumida === 'P' ? comuns.consumida : 'N',
      observacao: texto(comuns.observacao),
    },
    personalizados,
    extrasGdl: ehRegistro(valor.extrasGdl) ? valor.extrasGdl : {},
  }
}

export function criarDadosI801(): DadosI801 {
  return { pecas: [] }
}

export function lerDadosI801(json: string | null | undefined): { dados: DadosI801; raiz: Record<string, unknown> } {
  if (!json) return { dados: criarDadosI801(), raiz: {} }

  let raiz: unknown
  try {
    raiz = JSON.parse(json)
  } catch {
    throw new Error('O conteúdo específico da REP contém JSON inválido.')
  }
  if (!ehRegistro(raiz)) throw new Error('O conteúdo específico da REP não é um objeto válido.')

  const i801 = raiz.i801
  if (!ehRegistro(i801) || !Array.isArray(i801.pecas)) return { dados: criarDadosI801(), raiz }

  return {
    dados: { pecas: i801.pecas.map(normalizarPecaI801).filter((peca): peca is PecaI801 => Boolean(peca)) },
    raiz,
  }
}

export const i801Service: ExamService = {
  codigo: 'I-801',
  serialize(_data, contexto) {
    if (!contexto?.i801) throw new Error('O contexto das peças I-801 não está disponível.')
    return {
      ...contexto.i801.raiz,
      i801: contexto.i801.dados,
      ...(contexto.i801.metadadosIntegracaoGdl ? { integracaoGdl: contexto.i801.metadadosIntegracaoGdl } : {}),
    }
  },
  deserialize() { return {} },
}
