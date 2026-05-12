import { z } from "zod"

export const repSchema = z.object({
  id: z.string().uuid(),
  numero: z.string().min(1, "Número da REP é obrigatório").max(30).regex(/^(\d{1,3}|\d{1,3}\.\d{3})-\d{4}$/, "Formato inválido. Use entre 1-AAAA e 000.000-AAAA"),
  solicitante_id: z.string().uuid().nullable().optional(),
  tipo_exame_id: z.string().uuid().nullable().optional(),
  data_requisicao: z.string().min(1, "Data é obrigatória"),
  prazo: z.string().nullable().optional(),
  status: z.string().default("Pendente"),
  tipo_solicitacao: z.string().max(50).nullable().optional(),
  numero_documento: z.string().max(30).nullable().optional(),
  data_documento: z.string().nullable().optional(),
  autoridade_solicitante: z.string().max(200).nullable().optional(),
  nome_envolvido: z.string().max(200).nullable().optional(),
  data_acionamento: z.string().nullable().optional(),
  data_chegada: z.string().nullable().optional(),
  data_saida: z.string().nullable().optional(),
  local_fato: z.string().max(500).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  lacre_entrada: z.string().max(50).nullable().optional(),
  lacre_saida: z.string().max(50).nullable().optional(),
  usuario_id: z.string().uuid().nullable().optional(),
  numero_bo: z.string().max(30).nullable().optional(),
  numero_ip: z.string().max(30).nullable().optional(),
  observacoes: z.string().max(1000).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type REP = z.infer<typeof repSchema>

export const createRepSchema = repSchema.omit({
  id: true, status: true, created_at: true, updated_at: true,
})

export type CreateREPInput = z.infer<typeof createRepSchema>

export const updateRepSchema = repSchema.partial().omit({
  id: true, created_at: true, updated_at: true,
})

export type UpdateREPInput = z.infer<typeof updateRepSchema>

export const updateRepStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["Pendente", "Em Andamento", "Concluído"]),
})

export type UpdateREPStatusInput = z.infer<typeof updateRepStatusSchema>

export const atribuirPeritoREPSchema = z.object({
  rep_id: z.string().uuid(),
  usuario_id: z.string().uuid(),
})

export type AtribuirPeritoREPInput = z.infer<typeof atribuirPeritoREPSchema>

export const repResponseSchema = repSchema.partial()
export type REPResponse = z.infer<typeof repResponseSchema>
