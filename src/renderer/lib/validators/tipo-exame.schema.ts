import { z } from "zod"

/**
 * Schema de validação para entidade TipoExame
 * Tabela: tipos_exame
 */
export const tipoExameSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  codigo: z.string()
    .min(1, "Código é obrigatório")
    .max(20, "Código não pode exceder 20 caracteres"),
  nome: z.string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome não pode exceder 100 caracteres"),
  descricao: z.string()
    .max(500, "Descrição não pode exceder 500 caracteres")
    .optional()
    .nullable(),
  eh_local: z.boolean().default(false),
  ativo: z.boolean().default(true),
  data_criacao: z.date().default(() => new Date()),
  data_atualizacao: z.date().default(() => new Date()),
})

/**
 * Schema para criação de tipo de exame
 */
export const createTipoExameSchema = tipoExameSchema.omit({
  id: true,
  data_criacao: true,
  data_atualizacao: true,
  ativo: true,
})

/**
 * Schema para atualização de tipo de exame
 */
export const updateTipoExameSchema = tipoExameSchema.partial().omit({
  id: true,
  data_criacao: true,
})

/**
 * Schema para resposta de tipo de exame
 */
export const tipoExameResponseSchema = tipoExameSchema.omit({
  data_atualizacao: true,
}).partial({
  descricao: true,
  eh_local: true,
})

// Tipos inferidos
export type TipoExame = z.infer<typeof tipoExameSchema>
export type CreateTipoExameInput = z.infer<typeof createTipoExameSchema>
export type UpdateTipoExameInput = z.infer<typeof updateTipoExameSchema>
export type TipoExameResponse = z.infer<typeof tipoExameResponseSchema>
