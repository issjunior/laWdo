import { z } from 'zod';

/**
 * Schema de validação para entidade Placeholder
 * Tabela: placeholders (alinhado com schema SQL)
 */
const placeholderSchema = z.object({
  id: z.string(),
  chave: z.string()
    .min(1, 'Chave é obrigatória')
    .max(100, 'Chave não pode exceder 100 caracteres'),
  valor: z.string().default(''),
  descricao: z.string().nullable().optional(),
  categoria_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Placeholder = z.infer<typeof placeholderSchema>;
