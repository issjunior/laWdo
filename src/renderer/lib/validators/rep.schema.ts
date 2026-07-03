import { z } from "zod"

export const repSchema = z.object({
  id: z.string().uuid(),
  numero: z.string().min(1, "Número da REP é obrigatório").max(30).regex(/^(\d{1,3}|\d{1,3}\.\d{3})-\d{4}$/, "Formato inválido. Use entre 1-AAAA e 000.000-AAAA"),
  solicitante_id: z.string().uuid().nullable().optional(),
  tipo_exame_id: z.string().uuid().nullable().optional(),
  data_requisicao: z.string().min(1, "Data é obrigatória"),
  prazo: z.string().nullable().optional(),
  status: z.string().default("Pendente"),
  tipo_solicitacao: z.string().min(1, "Tipo de solicitação é obrigatório").max(50),
  numero_documento: z.string().min(1, "Nº da solicitação é obrigatório").max(30),
  data_documento: z.string().nullable().optional(),
  autoridade_solicitante: z.string().max(200).nullable().optional(),
  data_acionamento: z.string().nullable().optional(),
  data_chegada: z.string().nullable().optional(),
  data_saida: z.string().nullable().optional(),
  local_fato: z.string().max(500).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  usuario_id: z.string().uuid().nullable().optional(),
  observacoes: z.string().max(1000).nullable().optional(),
  campos_especificos: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type REP = z.infer<typeof repSchema>
