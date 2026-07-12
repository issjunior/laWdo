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

export const gdlOrigemSchema = z.object({
  tipo: textoOpcional,
  numero: textoOpcional,
  ano: textoFlexivel,
  cidade: textoOpcional,
}).passthrough()

export const gdlAndamentoSchema = z.object({
  dataHora: textoOpcional,
  nomeUsuario: textoOpcional,
  descricao: textoOpcional,
}).passthrough()

export const gdlPecaSchema = z.object({
  codPeca: numeroFlexivel,
  tipoPeca: z.string().min(1),
  identificacao: textoOpcional,
  quantidade: numeroFlexivel,
  unidadeMedida: textoOpcional,
  numeroAnalises: textoOpcional,
  examinadoInLoco: z.union([z.string(), z.boolean()]).nullish().transform(valor => valor ?? false),
  dataEntrada: textoOpcional,
  lacreEntrada: textoOpcional,
  lacreSaida: textoOpcional,
  consumida: textoOpcional,
}).catchall(z.unknown())

export const gdlRepSchema = z.object({
  codRep: numeroFlexivel,
  numero: numeroFlexivel,
  ano: numeroFlexivel,
  origens: z.array(gdlOrigemSchema).default([]),
  envolvidos: z.array(z.unknown()).default([]),
  pecas: z.array(gdlPecaSchema).default([]),
  andamentos: z.array(gdlAndamentoSchema).default([]),
}).catchall(z.unknown())

export type GdlPecaValidada = z.output<typeof gdlPecaSchema>
export type GdlRepValidada = z.output<typeof gdlRepSchema>

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
