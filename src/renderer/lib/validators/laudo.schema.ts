import { z } from "zod"

/**
 * Schema de validação para entidade Laudo
 * Tabela: laudos
 */
export const laudoSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  rep_id: z.string().uuid("ID da REP deve ser um UUID válido"),
  numero: z.string()
    .min(4, "Número do laudo deve ter pelo menos 4 caracteres")
    .max(20, "Número do laudo não pode exceder 20 caracteres"),
  versao: z.number()
    .int("Versão deve ser um número inteiro")
    .min(1, "Versão mínima é 1")
    .default(1),
  status: z.enum(["em_andamento", "concluido", "entregue"], {
    errorMap: () => ({ message: "Status deve ser: em_andamento, concluido ou entregue" }),
  }).default("em_andamento"),
  data_inicio: z.date().default(() => new Date()),
  data_conclusao: z.date()
    .optional()
    .nullable(),
  data_entrega: z.date()
    .optional()
    .nullable(),
  conteudo: z.string()
    .min(10, "Conteúdo deve ter pelo menos 10 caracteres")
    .max(100000, "Conteúdo não pode exceder 100.000 caracteres"),
  conclusao: z.string()
    .max(2000, "Conclusão não pode exceder 2000 caracteres")
    .optional()
    .nullable(),
  assinado_por: z.string()
    .max(100, "Assinado por não pode exceder 100 caracteres")
    .optional()
    .nullable(),
  data_assinatura: z.date()
    .optional()
    .nullable(),
  template_aplicado: z.string()
    .max(100, "Template aplicado não pode exceder 100 caracteres")
    .optional()
    .nullable(),
  hash_versao: z.string()
    .max(64, "Hash da versão não pode exceder 64 caracteres")
    .optional()
    .nullable(),
  observacoes: z.string()
    .max(1000, "Observações não podem exceder 1000 caracteres")
    .optional()
    .nullable(),
  data_criacao: z.date().default(() => new Date()),
  data_atualizacao: z.date().default(() => new Date()),
})

/**
 * Schema para criação de laudo
 */
export const createLaudoSchema = laudoSchema.omit({
  id: true,
  data_criacao: true,
  data_atualizacao: true,
  data_conclusao: true,
  data_entrega: true,
  data_assinatura: true,
  status: true,
  data_inicio: true,
  versao: true,
  hash_versao: true,
})

/**
 * Schema para atualização de laudo
 */
export const updateLaudoSchema = laudoSchema.partial().omit({
  id: true,
  data_criacao: true,
  rep_id: true,
  versao: true,
  hash_versao: true,
}).extend({
  conteudo: z.string()
    .min(10, "Conteúdo deve ter pelo menos 10 caracteres")
    .max(100000, "Conteúdo não pode exceder 100.000 caracteres")
    .optional(),
})

/**
 * Schema para mudança de status de laudo
 */
export const updateLaudoStatusSchema = z.object({
  status: z.enum(["em_andamento", "concluido", "entregue"], {
    errorMap: () => ({ message: "Status deve ser: em_andamento, concluido ou entregue" }),
  }),
  observacoes: z.string().max(500, "Observações não podem exceder 500 caracteres").optional().nullable(),
})

/**
 * Schema para criação de nova versão de laudo
 */
export const criarNovaVersaoLaudoSchema = z.object({
  motivo: z.string()
    .min(5, "Motivo deve ter pelo menos 5 caracteres")
    .max(200, "Motivo não pode exceder 200 caracteres"),
  conteudo: z.string()
    .min(10, "Conteúdo deve ter pelo menos 10 caracteres")
    .max(100000, "Conteúdo não pode exceder 100.000 caracteres"),
})

/**
 * Schema para assinatura de laudo
 */
export const assinarLaudoSchema = z.object({
  assinado_por: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome não pode exceder 100 caracteres"),
  cargo: z.string()
    .min(3, "Cargo deve ter pelo menos 3 caracteres")
    .max(50, "Cargo não pode exceder 50 caracteres"),
  data_assinatura: z.string().or(z.date()).default(() => new Date()),
})

/**
 * Schema para resposta de laudo
 */
export const laudoResponseSchema = laudoSchema

// Tipos inferidos dos schemas
export type Laudo = z.infer<typeof laudoSchema>
export type CreateLaudoInput = z.infer<typeof createLaudoSchema>
export type UpdateLaudoInput = z.infer<typeof updateLaudoSchema>
export type UpdateLaudoStatusInput = z.infer<typeof updateLaudoStatusSchema>
export type CriarNovaVersaoLaudoInput = z.infer<typeof criarNovaVersaoLaudoSchema>
export type AssinarLaudoInput = z.infer<typeof assinarLaudoSchema>
export type LaudoResponse = z.infer<typeof laudoResponseSchema>