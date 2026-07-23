import { z } from 'zod'

const textoOpcional = z.string().nullish().transform(valor => valor ?? '')
const textoFlexivel = z.union([z.string(), z.number()]).nullish().transform(valor => valor == null ? '' : String(valor))
const numeroFlexivel = z.union([z.number(), z.string()]).transform((valor, contexto) => {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Número inválido' })
    return z.NEVER
  }
  return numero
})

function normalizarChaveGdl(chave: string): string {
  return chave.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function aplicarAliasesDeCapitalizacao(payload: unknown, aliases: Record<string, string>): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const entrada = payload as Record<string, unknown>
  const saida = { ...entrada }
  for (const [chave, valor] of Object.entries(entrada)) {
    const destino = aliases[normalizarChaveGdl(chave)]
    if (destino && saida[destino] === undefined) saida[destino] = valor
  }
  return saida
}

const gdlOrigemSchema = z.object({
  tipo: textoOpcional,
  numero: textoOpcional,
  ano: textoFlexivel,
  cidade: textoOpcional,
}).passthrough()

const gdlAndamentoSchema = z.object({
  dataHora: textoOpcional,
  nomeUsuario: textoOpcional,
  descricao: textoOpcional,
}).passthrough()

const gdlArquivoRepSchema = z.preprocess(payload => aplicarAliasesDeCapitalizacao(payload, {
  nomearquivo: 'nomeArquivo',
  tamanho: 'tamanho',
  hash: 'hash',
  dataupload: 'dataUpload',
  fileid: 'fileId',
}), z.object({
  nomeArquivo: textoOpcional,
  tamanho: z.union([z.number(), z.string()]).nullish().transform(valor => {
    if (valor == null || valor === '') return null
    const numero = Number(valor)
    return Number.isFinite(numero) && numero >= 0 ? numero : null
  }),
  hash: z.string().nullish().transform(valor => valor ?? null),
  dataUpload: textoOpcional.transform(valor => valor || null),
  fileId: textoOpcional.transform(valor => valor || null),
}).catchall(z.unknown()))

const gdlPecaSchema = z.object({
  codPeca: numeroFlexivel,
  tipoPeca: z.string().min(1),
  identificacao: textoOpcional,
  quantidade: numeroFlexivel,
  unidadeMedida: textoOpcional,
  numeroAnalises: textoOpcional,
  quantidadeDescricao: textoOpcional,
  examinadoInLoco: z.union([z.string(), z.boolean()]).nullish().transform(valor => valor ?? false),
  incinerado: z.union([z.string(), z.boolean()]).nullish().transform(valor => valor == null ? '' : String(valor)),
  dataEntrada: textoOpcional,
  lacreEntrada: textoOpcional,
  lacreSaida: textoOpcional,
  dataLiberacao: textoOpcional,
  codigoVestigio: textoOpcional,
  consumida: textoOpcional,
  observacao: textoOpcional,
}).catchall(z.unknown())

const gdlRepSchema = z.preprocess(payload => aplicarAliasesDeCapitalizacao(payload, {
  anexoseletronicos: 'anexosEletronicos',
  arquivosadicionais: 'arquivosAdicionais',
  anexoeletronico: 'anexoEletronico',
  tipoanexoeletronico: 'tipoAnexoEletronico',
}), z.object({
  codRep: numeroFlexivel,
  numero: numeroFlexivel,
  ano: numeroFlexivel,
  origens: z.array(gdlOrigemSchema).default([]),
  envolvidos: z.array(z.unknown()).default([]),
  pecas: z.array(gdlPecaSchema).default([]),
  andamentos: z.array(gdlAndamentoSchema).default([]),
  anexoEletronico: z.union([z.boolean(), z.string(), z.number()]).nullish().transform(valor => valor ?? false),
  tipoAnexoEletronico: z.union([z.string(), z.number()]).nullish().transform(valor => valor == null ? null : String(valor)),
  anexosEletronicos: z.array(gdlArquivoRepSchema).default([]),
  arquivosAdicionais: z.array(gdlArquivoRepSchema).default([]),
}).catchall(z.unknown()))

const gdlRepInvestigacaoSchema = z.object({
  envolvidos: z.unknown().optional(),
}).catchall(z.unknown())

const gdlListaRepsInvestigacaoSchema = z.object({
  dadosREPs: z.array(gdlRepInvestigacaoSchema).default([]),
}).catchall(z.unknown())

export type GdlPecaValidada = z.output<typeof gdlPecaSchema>
export type GdlRepValidada = z.output<typeof gdlRepSchema>
export type GdlListaRepsInvestigacaoValidada = z.output<typeof gdlListaRepsInvestigacaoSchema>

export function validarGdlRep(payload: unknown): GdlRepValidada {
  return gdlRepSchema.parse(payload)
}

export function interpretarGdlRepJson(conteudo: string): GdlRepValidada {
  let payload: unknown
  try {
    payload = JSON.parse(conteudo)
  } catch {
    throw new Error('O GDL retornou JSON inválido.')
  }
  return validarGdlRep(payload)
}

export function interpretarGdlListaRepsInvestigacaoJson(conteudo: string): GdlListaRepsInvestigacaoValidada {
  let payload: unknown
  try {
    payload = JSON.parse(conteudo)
  } catch {
    throw new Error('O GDL retornou JSON inválido ao consultar envolvidos.')
  }
  return gdlListaRepsInvestigacaoSchema.parse(payload)
}
