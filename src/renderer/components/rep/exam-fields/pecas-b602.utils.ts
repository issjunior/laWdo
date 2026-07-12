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

/** Mescla uma nova consulta sem descartar dados locais ou alterar peças manuais. */
export function mesclarPecasB602DoGdl(
  atuais: PecaB602[],
  recebidas: PecaB602[],
  substituir: boolean,
): PecaB602[] {
  const porCodigoGdl = new Map(
    atuais
      .filter(peca => peca.codPecaGdl !== undefined)
      .map(peca => [peca.codPecaGdl, peca]),
  )
  const resultado = [...atuais]

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
