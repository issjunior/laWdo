import { z } from "zod"

export const templateSchema = z.object({
  id: z.string().uuid(),
  tipo_exame_id: z.string().uuid("Tipo de exame inválido"),
  nome: z.string().min(1, "Nome do template é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  descricao: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const createTemplateSchema = templateSchema.omit({
  id: true, created_at: true, updated_at: true,
})

export const updateTemplateSchema = templateSchema.partial().omit({
  id: true, created_at: true, updated_at: true,
})

export const secaoTemplateSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  nome: z.string().min(1, "Nome da seção é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  ordem: z.number().int().min(0),
  conteudo: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const createSecaoTemplateSchema = secaoTemplateSchema.omit({
  id: true, created_at: true, updated_at: true,
})

export const updateSecaoTemplateSchema = secaoTemplateSchema.partial().omit({
  id: true, template_id: true, created_at: true, updated_at: true,
})

export const reordenarSecoesSchema = z.object({
  template_id: z.string().uuid(),
  ids: z.array(z.string().uuid()),
})

export type Template = z.infer<typeof templateSchema>
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type SecaoTemplate = z.infer<typeof secaoTemplateSchema>
export type CreateSecaoTemplateInput = z.infer<typeof createSecaoTemplateSchema>
export type UpdateSecaoTemplateInput = z.infer<typeof updateSecaoTemplateSchema>
