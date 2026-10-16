import type { MetadadosIntegracaoGdl } from '../../shared/types/b602-gdl.types.js'
import type { ResultadoImportacaoGdl } from '../../shared/types/gdl-importacao.types.js'
import type { GdlRepValidada } from './gdl.schema.js'
import { converterRepB601 } from './gdl-b601-normalizador.service.js'
import { converterRepB602 } from './gdl-b602-normalizador.service.js'

type AdaptadorImportacaoGdl = (
  rep: GdlRepValidada,
  metadados?: MetadadosIntegracaoGdl,
) => ResultadoImportacaoGdl

const adaptadoresPorExame = new Map<string, AdaptadorImportacaoGdl>([
  ['B-601', converterRepB601],
  ['B-602', converterRepB602],
])

export function listarCodigosImportacaoGdl(): string[] {
  return [...adaptadoresPorExame.keys()];
}

export function converterRepGdl(
  codigoExame: string,
  rep: GdlRepValidada,
  metadados?: MetadadosIntegracaoGdl,
): ResultadoImportacaoGdl {
  const adaptador = adaptadoresPorExame.get(codigoExame.trim().toUpperCase())
  if (!adaptador) {
    throw new Error(`O exame ${codigoExame} não possui adaptador de importação GDL.`)
  }
  return adaptador(rep, metadados)
}
