import type {
  DadosImportacaoB602,
  MetadadosIntegracaoGdl,
  ResultadoImportacaoExame,
} from '../../shared/types/b602-gdl.types.js'
import type { GdlRepValidada } from './gdl.schema.js'
import { converterRepB602 } from './gdl-b602-normalizador.service.js'

type ResultadoImportacaoGdl = ResultadoImportacaoExame<DadosImportacaoB602>
type AdaptadorImportacaoGdl = (
  rep: GdlRepValidada,
  metadados?: MetadadosIntegracaoGdl,
) => ResultadoImportacaoGdl

const adaptadoresPorExame = new Map<string, AdaptadorImportacaoGdl>([
  ['B-602', converterRepB602],
])

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
