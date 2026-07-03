import { z } from "zod"

/**
 * Schema de validação para entidade User (Perito)
 * Tabela: users
 */
export const userSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  nome: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome não pode exceder 100 caracteres"),
  matricula: z.string()
    .min(4, "Matrícula deve ter pelo menos 4 caracteres")
    .max(20, "Matrícula não pode exceder 20 caracteres"),
  cargo: z.string()
    .min(3, "Cargo deve ter pelo menos 3 caracteres")
    .max(50, "Cargo não pode exceder 50 caracteres"),
  lotacao: z.string()
    .min(3, "Lotação deve ter pelo menos 3 caracteres")
    .max(100, "Lotação não pode exceder 100 caracteres"),
  email: z.string()
    .email("Email inválido")
    .max(100, "Email não pode exceder 100 caracteres"),
  telefone: z.string()
    .max(20, "Telefone não pode exceder 20 caracteres")
    .optional()
    .nullable(),
  username: z.string()
    .min(3, "Username deve ter pelo menos 3 caracteres")
    .max(50, "Username não pode exceder 50 caracteres")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username pode conter apenas letras, números, pontos, underscores e hífens"),
  senha_hash: z.string()
    .min(8, "Senha hash deve ter pelo menos 8 caracteres")
    .max(255, "Senha hash não pode exceder 255 caracteres"),
  ativo: z.boolean().default(true),
  data_criacao: z.date().default(() => new Date()),
  data_atualizacao: z.date().default(() => new Date()),
})

/**
 * Schema para criação de usuário (sem ID, datas automáticas)
 */
export const createUserSchema = userSchema.omit({
  id: true,
  data_criacao: true,
  data_atualizacao: true,
  ativo: true,
  senha_hash: true,
}).extend({
  senha: z.string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .max(100, "Senha não pode exceder 100 caracteres")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos um número"),
  confirmar_senha: z.string(),
}).refine((data) => data.senha === data.confirmar_senha, {
  message: "Senhas não conferem",
  path: ["confirmar_senha"],
})

/**
 * Schema para atualização de usuário (campos opcionais)
 */
export const updateUserSchema = userSchema.partial().omit({
  id: true,
  data_criacao: true,
  senha_hash: true,
}).extend({
  senha_atual: z.string().optional(),
  nova_senha: z.string()
    .min(8, "Nova senha deve ter pelo menos 8 caracteres")
    .max(100, "Nova senha não pode exceder 100 caracteres")
    .optional(),
  confirmar_nova_senha: z.string().optional(),
}).refine((data) => {
  if (data.nova_senha && !data.senha_atual) {
    return false
  }
  return true
}, {
  message: "Senha atual é necessária para alterar a senha",
  path: ["senha_atual"],
}).refine((data) => {
  if (data.nova_senha && data.confirmar_nova_senha !== data.nova_senha) {
    return false
  }
  return true
}, {
  message: "Nova senha e confirmação não conferem",
  path: ["confirmar_nova_senha"],
})

/**
 * Schema para login de usuário
 */
export const loginSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  senha: z.string().min(1, "Senha é obrigatória"),
})

/**
 * Schema para resposta de usuário (sem dados sensíveis)
 */
export const userResponseSchema = userSchema.omit({
  senha_hash: true,
})

// Tipos inferidos dos schemas
export type User = z.infer<typeof userSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
