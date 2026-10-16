import { TIPOS_PECA_B601_POR_CODIGO } from '../catalogos/b601.catalogo.js'
import type { CampoPersonalizadoBalistica, PecaBalistica } from '../types/pecas-balistica.types.js'

interface CampoAdicionalB601 {
  chave: string
  rotulo: string
  valor: unknown
}

function normalizarNome(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
}

function normalizarChave(valor: string): string {
  return normalizarNome(valor).replace(/[^a-z0-9]/g, '')
}

export function converterValorPersonalizadoB601(campo: CampoPersonalizadoBalistica, valor: unknown): string | undefined {
  if (typeof valor !== 'string' && typeof valor !== 'number') return undefined
  const texto = String(valor).trim()
  if (!texto) return ''
  if (!campo.opcoes) return texto
  const opcao = campo.opcoes.find(item => item.codigo === texto || normalizarNome(item.label) === normalizarNome(texto))
  if (campo.controle === 'combobox') return opcao?.label ?? texto
  return opcao?.codigo
}

export function preencherOrigemColetaB601<T extends PecaBalistica>(peca: T): T {
  if (!['101', '105'].includes(peca.tipoCodigo)) return peca
  const campo = TIPOS_PECA_B601_POR_CODIGO.get(peca.tipoCodigo)?.campos.find(item => item.chaveGdl === 'ORIGEM/COLETA')
  if (!campo || String(peca.personalizados[campo.id] ?? '').trim()) return peca
  const recebidos = Object.entries(peca.extrasGdl).filter(([chave]) => normalizarChave(chave) === normalizarChave(campo.chaveGdl))
  if (recebidos.length !== 1) return peca
  const valor = converterValorPersonalizadoB601(campo, recebidos[0][1])
  if (!valor) return peca
  return { ...peca, personalizados: { ...peca.personalizados, [campo.id]: valor } }
}

export function separarCamposAdicionaisB601(
  dados: Record<string, unknown>,
  tipoCodigo?: string,
  personalizados: Record<string, unknown> = {},
): { revisao: CampoAdicionalB601[]; informativos: CampoAdicionalB601[] } {
  const revisao: CampoAdicionalB601[] = []
  const informativos: CampoAdicionalB601[] = []
  const tipo = tipoCodigo ? TIPOS_PECA_B601_POR_CODIGO.get(tipoCodigo) : undefined

  for (const [chave, valor] of Object.entries(dados)) {
    const nome = normalizarChave(chave)
    const numeroAnalises = ['numeroanalises', 'nanalises'].includes(nome)
    const campo = tipo?.campos.find(item => item.mapeamentoApiConfirmado
      && [item.chaveGdl, ...(item.aliasesGdl ?? [])].some(alias => normalizarChave(alias) === nome))
    const convertido = campo ? converterValorPersonalizadoB601(campo, valor) : undefined
    const jaPreenchido = campo && convertido !== undefined && personalizados[campo.id] === convertido
    const vazio = valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim())
      || (typeof valor === 'object' && Object.keys(valor).length === 0)
    const adicional = { chave, rotulo: numeroAnalises ? 'Nº Análises' : campo?.label ?? chave, valor }
    if (numeroAnalises || vazio || jaPreenchido) informativos.push(adicional)
    else revisao.push(adicional)
  }

  return { revisao, informativos }
}
