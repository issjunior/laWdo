import { z } from 'zod';

/**
 * Schema de validação para entidade Placeholder
 * Tabela: placeholders (alinhado com schema SQL)
 */
export const placeholderSchema = z.object({
  id: z.string(),
  chave: z.string()
    .min(1, 'Chave é obrigatória')
    .max(100, 'Chave não pode exceder 100 caracteres'),
  valor: z.string().default(''),
  descricao: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createPlaceholderSchema = z.object({
  chave: z.string()
    .min(1, 'Chave é obrigatória')
    .max(100, 'Chave não pode exceder 100 caracteres'),
  valor: z.string().optional().default(''),
  descricao: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
});

export const updatePlaceholderSchema = z.object({
  chave: z.string().min(1).max(100).optional(),
  valor: z.string().optional(),
  descricao: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
});

export type Placeholder = z.infer<typeof placeholderSchema>;
export type CreatePlaceholderInput = z.infer<typeof createPlaceholderSchema>;
export type UpdatePlaceholderInput = z.infer<typeof updatePlaceholderSchema>;
