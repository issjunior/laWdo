import { z } from "zod"

/**
 * Schema de validação para entidade LogAuditoria
 * Tabela: logs_auditoria
 */
export const logAuditoriaSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  usuario_id: z.string().uuid("ID do usuário deve ser um UUID válido").optional().nullable(),
  acao: z.string()
    .min(3, "Ação deve ter pelo menos 3 caracteres")
    .max(100, "Ação não pode exceder 100 caracteres"),
  tipo_acao: z.enum([
    "login",
    "logout",
    "criacao",
    "atualizacao",
    "exclusao",
    "leitura",
    "exportacao",
    "importacao",
    "backup",
    "restauracao",
    "configuracao",
    "erro",
    "outro"
  ], {
    errorMap: () => ({ message: "Tipo de ação inválido" }),
  }).default("outro"),
  modulo: z.enum([
    "autenticacao",
    "usuario",
    "solicitante",
    "tipo_exame",
    "rep",
    "laudo",
    "imagem",
    "placeholder",
    "sistema",
    "backup",
    "exportacao"
  ], {
    errorMap: () => ({ message: "Módulo inválido" }),
  }).default("sistema"),
  entidade_id: z.string()
    .max(100, "ID da entidade não pode exceder 100 caracteres")
    .optional()
    .nullable(),
  dados_anteriores: z.string()
    .max(5000, "Dados anteriores não podem exceder 5000 caracteres")
    .optional()
    .nullable(),
  dados_novos: z.string()
    .max(5000, "Dados novos não podem exceder 5000 caracteres")
    .optional()
    .nullable(),
  ip: z.string()
    .max(45, "IP não pode exceder 45 caracteres")
    .optional()
    .nullable(),
  user_agent: z.string()
    .max(500, "User Agent não pode exceder 500 caracteres")
    .optional()
    .nullable(),
  nivel: z.enum(["info", "warning", "error", "debug"], {
    errorMap: () => ({ message: "Nível deve ser: info, warning, error ou debug" }),
  }).default("info"),
  mensagem: z.string()
    .min(3, "Mensagem deve ter pelo menos 3 caracteres")
    .max(1000, "Mensagem não pode exceder 1000 caracteres"),
  detalhes: z.string()
    .max(5000, "Detalhes não podem exceder 5000 caracteres")
    .optional()
    .nullable(),
  data_criacao: z.date().default(() => new Date()),
})

/**
 * Schema para criação de log de auditoria
 */
export const createLogAuditoriaSchema = logAuditoriaSchema.omit({
  id: true,
  data_criacao: true,
}).extend({
  usuario_id: z.string().uuid("ID do usuário deve ser um UUID válido").optional().nullable(),
  entidade_id: z.string().max(100, "ID da entidade não pode exceder 100 caracteres").optional().nullable(),
  dados_anteriores: z.any().optional().nullable().transform(val => val ? JSON.stringify(val) : null),
  dados_novos: z.any().optional().nullable().transform(val => val ? JSON.stringify(val) : null),
})

/**
 * Schema para consulta de logs
 */
export const consultarLogsSchema = z.object({
  data_inicio: z.string().or(z.date()).optional().transform(val => val ? new Date(val) : undefined),
  data_fim: z.string().or(z.date()).optional().transform(val => val ? new Date(val) : undefined),
  usuario_id: z.string().uuid("ID do usuário deve ser um UUID válido").optional(),
  modulo: z.string().optional(),
  tipo_acao: z.string().optional(),
  nivel: z.string().optional(),
  limite: z.number().int("Limite deve ser um número inteiro").min(1).max(1000).default(100),
  offset: z.number().int("Offset deve ser um número inteiro").min(0).default(0),
})

/**
 * Schema para resposta de log de auditoria
 */
export const logAuditoriaResponseSchema = logAuditoriaSchema

// Tipos inferidos dos schemas
export type LogAuditoria = z.infer<typeof logAuditoriaSchema>
export type CreateLogAuditoriaInput = z.infer<typeof createLogAuditoriaSchema>
export type ConsultarLogsInput = z.infer<typeof consultarLogsSchema>
export type LogAuditoriaResponse = z.infer<typeof logAuditoriaResponseSchema>