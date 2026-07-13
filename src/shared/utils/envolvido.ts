export interface PartesEnvolvido {
  qualificacao: string
  nome: string
}

export function separarEnvolvido(valor: string): PartesEnvolvido {
  const texto = valor.trim()
  const separador = texto.indexOf(':')
  if (separador < 0) return { qualificacao: '', nome: texto }

  return {
    qualificacao: texto.slice(0, separador + 1).trim(),
    nome: texto.slice(separador + 1).trim(),
  }
}

export function combinarEnvolvido(qualificacao: string, nome: string): string {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return ''

  const qualificacaoNormalizada = qualificacao.trim()
  if (!qualificacaoNormalizada) return nomeNormalizado

  const qualificacaoComSeparador = qualificacaoNormalizada.endsWith(':')
    ? qualificacaoNormalizada
    : `${qualificacaoNormalizada}:`
  return `${qualificacaoComSeparador} ${nomeNormalizado}`
}
