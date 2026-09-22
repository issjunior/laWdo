import { useEffect, useState } from 'react'

export function VersaoAplicativo() {
  const [versao, setVersao] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    void window.ipcAPI.getAppInfo()
      .then((informacoes) => {
        if (ativo) setVersao(informacoes.version)
      })
      .catch(() => {
        if (ativo) setVersao(null)
      })

    return () => {
      ativo = false
    }
  }, [])

  if (!versao) return null

  return (
    <p className="text-xs text-muted-foreground" aria-label={`Versão do laWdo: ${versao}`}>
      laWdo v{versao}
    </p>
  )
}
