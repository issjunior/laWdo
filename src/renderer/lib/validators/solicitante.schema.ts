import { z } from "zod"

/**
 * Schema de validação para entidade Solicitante
 * Tabela: solicitantes
 */
const solicitanteSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  nome: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(150, "Nome não pode exceder 150 caracteres"),
  tipo: z.string()
    .min(2, "Tipo deve ter pelo menos 2 caracteres")
    .max(50, "Tipo não pode exceder 50 caracteres"),
  endereco: z.string()
    .max(200, "Endereço não pode exceder 200 caracteres")
    .optional(),
  telefone: z.string()
    .regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone deve estar no formato (99) 9999-9999 ou (99) 99999-9999")
    .max(20, "Telefone não pode exceder 20 caracteres")
    .optional(),
  email: z.string()
    .email("Email inválido")
    .max(100, "Email não pode exceder 100 caracteres")
    .optional(),
  ativo: z.boolean().default(true),
  created_at: z.string().datetime("Data de criação inválida").optional(),
  updated_at: z.string().datetime("Data de atualização inválida").optional(),
})

/**
 * Schema para criação de solicitante
 */
export const createSolicitanteSchema = z.object({
  nome: solicitanteSchema.shape.nome.min(2, "Nome é obrigatório"),
  tipo: z.string().max(50, "Tipo não pode exceder 50 caracteres").optional().or(z.literal('')),
  endereco: solicitanteSchema.shape.endereco.optional(),
  telefone: z.string().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone deve estar no formato (99) 9999-9999 ou (99) 99999-9999")
    .max(20, "Telefone não pode exceder 20 caracteres")
    .optional()
    .or(z.literal('')),
  email: z.string().email("Email inválido")
    .max(100, "Email não pode exceder 100 caracteres")
    .optional()
    .or(z.literal('')),
})

// Tipos inferidos dos schemas
export type Solicitante = z.infer<typeof solicitanteSchema>
export type CreateSolicitanteInput = z.infer<typeof createSolicitanteSchema>
