import { z } from 'zod';

export const categoriasColetaGdl = ['local', 'necropsia'] as const;
export type CategoriaColetaGdl = typeof categoriasColetaGdl[number];

export function categoriaColetaPorCodigoNatureza(codigoNatureza: string): CategoriaColetaGdl | null {
  if (/^M\d{3}$/.test(codigoNatureza)) return 'local';
  if (/^T\d{3}$/.test(codigoNatureza)) return 'necropsia';
  return null;
}

const esquemaReferenciaColetaGdl = z.object({
  numero: z.string().regex(/^\d+$/),
  ano: z.string().regex(/^\d{4}$/),
  codigoNatureza: z.string().regex(/^[MT]\d{3}$/),
  categoriaColeta: z.enum(categoriasColetaGdl).optional(),
}).transform(referencia => ({
  ...referencia,
  categoriaColeta: referencia.categoriaColeta ?? categoriaColetaPorCodigoNatureza(referencia.codigoNatureza)!,
})).refine(referencia => referencia.categoriaColeta === categoriaColetaPorCodigoNatureza(referencia.codigoNatureza), {
  message: 'A categoria de coleta diverge do código da natureza do exame.',
  path: ['categoriaColeta'],
});

export const esquemaRepsMesmoCasoGdl = z.object({
  ambiente: z.enum(['producao', 'homologacao']),
  numeroRep: z.string().regex(/^\d+$/),
  anoRep: z.string().regex(/^\d{4}$/),
  numeroCaso: z.string().regex(/^[1-9]\d*$/),
  consultadoEm: z.string().datetime(),
  reps: z.array(esquemaReferenciaColetaGdl),
});

export type RepsMesmoCasoGdl = z.infer<typeof esquemaRepsMesmoCasoGdl>;

export function formatarReferenciaColeta(rep: Pick<RepsMesmoCasoGdl['reps'][number], 'numero' | 'ano'>): string {
  return `${rep.numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}/${rep.ano}`;
}

export function categoriaColetaPorOrigem(origem: string): CategoriaColetaGdl | null {
  const normalizada = origem.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  if (normalizada === '93' || normalizada === 'LOCAL DE CRIME') return 'local';
  if (normalizada === '94' || normalizada === 'NECROPSIA') return 'necropsia';
  return null;
}

export function sugerirRepColeta(origem: string, referencias?: RepsMesmoCasoGdl): string {
  const categoria = categoriaColetaPorOrigem(origem);
  const compativeis = categoria ? referencias?.reps.filter(rep => rep.categoriaColeta === categoria) ?? [] : [];
  return compativeis.length === 1 ? formatarReferenciaColeta(compativeis[0]) : '';
}
