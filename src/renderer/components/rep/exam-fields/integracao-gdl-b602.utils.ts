import { z } from 'zod'
import type { MetadadosIntegracaoGdl, PecaB602 } from '@shared/types/b602-gdl.types'

const referenciaOrigemGdlSchema = z.object({
  tipo: z.string(),
  numero: z.string(),
})

const dadosSolicitacaoGdlSchema = z.object({
  orgao: z.string(),
  responsavel: z.string(),
  autoridade: z.string(),
  origensDisponiveis: z.array(referenciaOrigemGdlSchema).optional(),
  origensCandidatasSolicitacao: z.array(referenciaOrigemGdlSchema).optional(),
}).transform(({ origensDisponiveis, origensCandidatasSolicitacao, ...dados }) => ({
  ...dados,
  origensDisponiveis: origensDisponiveis ?? origensCandidatasSolicitacao ?? [],
}))

const dadosInvestigacaoGdlSchema = z.object({
  envolvidos: z.array(z.string()),
  boletinsOcorrencia: z.array(referenciaOrigemGdlSchema),
  inqueritosPoliciais: z.array(referenciaOrigemGdlSchema),
})

const metadadosIntegracaoGdlSchema = z.object({
  origemInicial: z.enum(['manual', 'gdl']),
  dadosSolicitacao: dadosSolicitacaoGdlSchema.optional(),
  dadosInvestigacao: dadosInvestigacaoGdlSchema.optional(),
  ultimaConsulta: z.object({
    ambiente: z.enum(['homologacao', 'producao']),
    numeroRep: z.string(),
    anoRep: z.string(),
    consultadoEm: z.string(),
  }).optional(),
})

export function extrairPecasB602(serializado: string | null | undefined): PecaB602[] {
  if (!serializado) return []

  try {
    const raiz: unknown = JSON.parse(serializado)
    if (typeof raiz !== 'object' || raiz === null) return []
    const b602 = (raiz as Record<string, unknown>).b602
    if (typeof b602 !== 'object' || b602 === null) return []
    const pecas = (b602 as Record<string, unknown>).pecas
    if (!Array.isArray(pecas)) return []

    return pecas.filter((peca): peca is PecaB602 => {
      if (typeof peca !== 'object' || peca === null) return false
      const candidata = peca as Record<string, unknown>
      return typeof candidata.idLocal === 'string'
        && (candidata.origem === 'manual' || candidata.origem === 'gdl')
        && typeof candidata.tipoPeca === 'string'
        && typeof candidata.comuns === 'object'
        && candidata.comuns !== null
        && typeof candidata.personalizados === 'object'
        && candidata.personalizados !== null
        && typeof candidata.extrasGdl === 'object'
        && candidata.extrasGdl !== null
    }).map(peca => ({
      ...peca,
      comuns: {
        ...peca.comuns,
        materialIncinerado: peca.comuns.materialIncinerado === 'S' ? 'S' : 'N',
      },
    }))
  } catch {
    return []
  }
}

export function extrairMetadadosIntegracaoGdl(
  serializado: string | null | undefined,
): MetadadosIntegracaoGdl | null {
  if (!serializado) return null

  try {
    const raiz: unknown = JSON.parse(serializado)
    if (typeof raiz !== 'object' || raiz === null) return null

    const resultado = metadadosIntegracaoGdlSchema.safeParse(
      (raiz as Record<string, unknown>).integracaoGdl,
    )

    return resultado.success ? resultado.data : null
  } catch {
    return null
  }
}
