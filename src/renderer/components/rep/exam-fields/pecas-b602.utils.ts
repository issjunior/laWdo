import type { PecaB602 } from '@shared/types/b602-gdl.types'

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

export interface ItemReconciliacaoPecaB602 {
  chave: string
  peca: PecaB602
  jaImportada: boolean
  retornadaPeloGdl: boolean
}

export function montarItensReconciliacaoPecasB602(
  atuais: PecaB602[],
  pecasRetornadasPeloGdl: PecaB602[],
): ItemReconciliacaoPecaB602[] {
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

export function obterPecasImportadasAusentesDoGdl(
  atuais: PecaB602[],
  pecasRetornadasPeloGdl: PecaB602[],
): PecaB602[] {
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
export function mesclarPecasB602DoGdl(
  atuais: PecaB602[],
  recebidas: PecaB602[],
  substituir: boolean,
  removerPecasImportadasAusentes: boolean = false,
  pecasRetornadasPeloGdl: PecaB602[] = recebidas,
): PecaB602[] {
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
      ? { ...recebida, idLocal: existente.idLocal }
      : {
          ...existente,
          comuns: Object.fromEntries(
            Object.entries(existente.comuns).map(([chave, valor]) => [
              chave,
              valorEstaVazio(valor) ? recebida.comuns[chave as keyof PecaB602['comuns']] : valor,
            ]),
          ) as PecaB602['comuns'],
          personalizados: mesclarCamposPersonalizados(existente.personalizados, recebida.personalizados),
          extrasGdl: { ...recebida.extrasGdl, ...existente.extrasGdl },
        }
  }

  return resultado
}
