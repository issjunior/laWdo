import type { PecaBalistica } from '@shared/types/pecas-balistica.types'

function valorEstaVazio(valor: unknown): boolean {
  return valor === '' || valor === null || valor === undefined
}

function mesclarCamposPersonalizados(
  atuais: Record<string, unknown>,
  recebidos: Record<string, unknown>,
): Record<string, unknown> {
  const resultado = { ...recebidos }

  for (const [chave, valor] of Object.entries(atuais)) {
    if (!valorEstaVazio(valor)) resultado[chave] = valor
  }

  return resultado
}

export interface ItemReconciliacaoPecaBalistica<TPeca extends PecaBalistica = PecaBalistica> {
  chave: string
  peca: TPeca
  jaImportada: boolean
  retornadaPeloGdl: boolean
}

export function montarItensReconciliacaoPecasBalistica<TPeca extends PecaBalistica>(
  atuais: TPeca[],
  pecasRetornadasPeloGdl: TPeca[],
): ItemReconciliacaoPecaBalistica<TPeca>[] {
  const importadasPorCodigo = new Map(
    atuais
      .filter(peca => peca.origem === 'gdl' && peca.codPecaGdl !== undefined)
      .map(peca => [peca.codPecaGdl, peca]),
  )
  const codigosRetornados = new Set<number>()
  const resultado = pecasRetornadasPeloGdl.map(peca => {
    if (peca.codPecaGdl !== undefined) codigosRetornados.add(peca.codPecaGdl)
    return {
      chave: `gdl-${peca.codPecaGdl ?? peca.idLocal}`,
      peca,
      jaImportada: peca.codPecaGdl !== undefined && importadasPorCodigo.has(peca.codPecaGdl),
      retornadaPeloGdl: true,
    }
  })

  for (const peca of importadasPorCodigo.values()) {
    if (!codigosRetornados.has(peca.codPecaGdl!)) {
      resultado.push({
        chave: `gdl-${peca.codPecaGdl}`,
        peca,
        jaImportada: true,
        retornadaPeloGdl: false,
      })
    }
  }

  return resultado
}

export function obterPecasImportadasAusentesDoGdl<TPeca extends PecaBalistica>(
  atuais: TPeca[],
  pecasRetornadasPeloGdl: TPeca[],
): TPeca[] {
  const codigosRetornados = new Set(
    pecasRetornadasPeloGdl
      .map(peca => peca.codPecaGdl)
      .filter((codigo): codigo is number => codigo !== undefined),
  )

  return atuais.filter(peca => (
    peca.origem === 'gdl'
    && peca.codPecaGdl !== undefined
    && !codigosRetornados.has(peca.codPecaGdl)
  ))
}

/** Mescla uma nova consulta sem descartar dados locais ou alterar peças manuais. */
export function mesclarPecasBalisticaDoGdl<TPeca extends PecaBalistica>(
  atuais: TPeca[],
  recebidas: TPeca[],
  substituir: boolean,
  removerPecasImportadasAusentes: boolean = false,
  pecasRetornadasPeloGdl: PecaBalistica[] = recebidas,
  preservarNaoMapeados = false,
): TPeca[] {
  const porCodigoGdl = new Map(
    atuais
      .filter(peca => peca.codPecaGdl !== undefined)
      .map(peca => [peca.codPecaGdl, peca]),
  )
  const ausentes = removerPecasImportadasAusentes
    ? new Set(obterPecasImportadasAusentesDoGdl(atuais, pecasRetornadasPeloGdl).map(peca => peca.idLocal))
    : new Set<string>()
  const resultado = atuais.filter(peca => !ausentes.has(peca.idLocal))

  for (const recebida of recebidas) {
    const existente = recebida.codPecaGdl === undefined ? undefined : porCodigoGdl.get(recebida.codPecaGdl)
    if (!existente) {
      resultado.push(recebida)
      continue
    }
    if (!substituir && existente.alteradaLocalmente) continue

    const indice = resultado.findIndex(peca => peca.idLocal === existente.idLocal)
    if (indice < 0) continue

    resultado[indice] = substituir
      ? { ...recebida, idLocal: existente.idLocal, ...(preservarNaoMapeados ? {
          personalizados: { ...existente.personalizados, ...recebida.personalizados },
          extrasGdl: { ...existente.extrasGdl, ...recebida.extrasGdl },
        } : {}) }
      : {
          ...existente,
          comuns: Object.fromEntries(
            Object.entries(existente.comuns).map(([chave, valor]) => [
              chave,
              valorEstaVazio(valor) ? recebida.comuns[chave as keyof PecaBalistica['comuns']] : valor,
            ]),
          ) as TPeca['comuns'],
          personalizados: mesclarCamposPersonalizados(existente.personalizados, recebida.personalizados),
          extrasGdl: { ...recebida.extrasGdl, ...existente.extrasGdl },
        }
  }

  return resultado
}
