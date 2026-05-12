import { z } from "zod"

/**
 * Schema de validação para entidade ImagemLaudo
 * Tabela: imagens_laudo
 */
export const imagemLaudoSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  laudo_id: z.string().uuid("ID do laudo deve ser um UUID válido"),
  caminho: z.string()
    .min(1, "Caminho é obrigatório")
    .max(500, "Caminho não pode exceder 500 caracteres"),
  legenda: z.string()
    .min(3, "Legenda deve ter pelo menos 3 caracteres")
    .max(500, "Legenda não pode exceder 500 caracteres"),
  numero_figura: z.number()
    .int("Número da figura deve ser um número inteiro")
    .min(1, "Número da figura mínimo é 1"),
  sequencia: z.number()
    .int("Sequência deve ser um número inteiro")
    .min(0, "Sequência mínima é 0")
    .default(0),
  tipo: z.enum(["foto", "diagrama", "grafico", "documento", "outro"], {
    errorMap: () => ({ message: "Tipo deve ser: foto, diagrama, grafico, documento ou outro" }),
  }).default("foto"),
  gps_latitude: z.number()
    .min(-90, "Latitude deve estar entre -90 e 90")
    .max(90, "Latitude deve estar entre -90 e 90")
    .optional()
    .nullable(),
  gps_longitude: z.number()
    .min(-180, "Longitude deve estar entre -180 e 180")
    .max(180, "Longitude deve estar entre -180 e 180")
    .optional()
    .nullable(),
  data_captura: z.date()
    .optional()
    .nullable(),
  resolucao: z.string()
    .max(20, "Resolução não pode exceder 20 caracteres")
    .optional()
    .nullable(),
  tamanho_bytes: z.number()
    .int("Tamanho deve ser um número inteiro")
    .min(0, "Tamanho mínimo é 0")
    .optional()
    .nullable(),
  formato: z.string()
    .max(10, "Formato não pode exceder 10 caracteres")
    .optional()
    .nullable(),
  ativo: z.boolean().default(true),
  observacoes: z.string()
    .max(1000, "Observações não podem exceder 1000 caracteres")
    .optional()
    .nullable(),
  data_criacao: z.date().default(() => new Date()),
  data_atualizacao: z.date().default(() => new Date()),
})

/**
 * Schema para criação de imagem de laudo
 */
export const createImagemLaudoSchema = imagemLaudoSchema.omit({
  id: true,
  data_criacao: true,
  data_atualizacao: true,
  ativo: true,
}).extend({
  data_captura: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  gps_latitude: z.string().or(z.number()).optional().nullable().transform(val => val ? Number(val) : null),
  gps_longitude: z.string().or(z.number()).optional().nullable().transform(val => val ? Number(val) : null),
  tamanho_bytes: z.string().or(z.number()).optional().nullable().transform(val => val ? Number(val) : null),
})

/**
 * Schema para atualização de imagem de laudo
 */
export const updateImagemLaudoSchema = imagemLaudoSchema.partial().omit({
  id: true,
  data_criacao: true,
  laudo_id: true,
}).extend({
  data_captura: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  gps_latitude: z.string().or(z.number()).optional().nullable().transform(val => val ? Number(val) : null),
  gps_longitude: z.string().or(z.number()).optional().nullable().transform(val => val ? Number(val) : null),
  tamanho_bytes: z.string().or(z.number()).optional().nullable().transform(val => val ? Number(val) : null),
})

/**
 * Schema para reordenação de imagens
 */
export const reordenarImagensSchema = z.object({
  imagens: z.array(z.object({
    id: z.string().uuid("ID deve ser um UUID válido"),
    sequencia: z.number().int("Sequência deve ser um número inteiro").min(0),
  })).min(1, "Pelo menos uma imagem deve ser fornecida"),
})

/**
 * Schema para resposta de imagem de laudo
 */
export const imagemLaudoResponseSchema = imagemLaudoSchema

// Tipos inferidos dos schemas
export type ImagemLaudo = z.infer<typeof imagemLaudoSchema>
export type CreateImagemLaudoInput = z.infer<typeof createImagemLaudoSchema>
export type UpdateImagemLaudoInput = z.infer<typeof updateImagemLaudoSchema>
export type ReordenarImagensInput = z.infer<typeof reordenarImagensSchema>
export type ImagemLaudoResponse = z.infer<typeof imagemLaudoResponseSchema>