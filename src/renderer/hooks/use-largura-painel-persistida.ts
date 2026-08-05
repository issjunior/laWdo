import { useCallback, useMemo } from 'react'

export function limitarLarguraPainel(largura: number, minima: number, maxima: number): number {
  return Math.min(maxima, Math.max(minima, largura))
}

export function lerLarguraPainelPersistida(
  chave: string,
  padrao: number,
  minima: number,
  maxima: number,
): number {
  if (typeof window === 'undefined') return padrao

  const valorArmazenado = window.localStorage.getItem(chave)
  if (valorArmazenado === null) return padrao

  const largura = Number(valorArmazenado)
  if (!Number.isFinite(largura)) return padrao

  return limitarLarguraPainel(largura, minima, maxima)
}

export function useLarguraPainelPersistida(
  chave: string,
  padrao: number,
  minima: number,
  maxima: number,
) {
  const largura = useMemo(
    () => lerLarguraPainelPersistida(chave, padrao, minima, maxima),
    [chave, maxima, minima, padrao],
  )

  const persistirLargura = useCallback(
    (novaLargura: number) => {
      if (!Number.isFinite(novaLargura)) return

      const larguraLimitada = limitarLarguraPainel(novaLargura, minima, maxima)
      window.localStorage.setItem(chave, String(Math.round(larguraLimitada)))
    },
    [chave, maxima, minima],
  )

  return { largura, persistirLargura }
}
