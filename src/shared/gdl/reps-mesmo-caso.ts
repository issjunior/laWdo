import { z } from 'zod';

export const esquemaRepsMesmoCasoGdl = z.object({
  ambiente: z.enum(['producao', 'homologacao']),
  numeroRep: z.string().regex(/^\d+$/),
  anoRep: z.string().regex(/^\d{4}$/),
  numeroCaso: z.string().regex(/^[1-9]\d*$/),
  consultadoEm: z.string().datetime(),
  reps: z.array(z.object({
    numero: z.string().regex(/^\d+$/),
    ano: z.string().regex(/^\d{4}$/),
    codigoNatureza: z.enum(['M110', 'T002']),
  })),
});

export type RepsMesmoCasoGdl = z.infer<typeof esquemaRepsMesmoCasoGdl>;

export function formatarReferenciaColeta(rep: Pick<RepsMesmoCasoGdl['reps'][number], 'numero' | 'ano'>): string {
  return `${rep.numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}/${rep.ano}`;
}

export function codigoColetaPorOrigem(origem: string): 'M110' | 'T002' | null {
  const normalizada = origem.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  if (normalizada === '93' || normalizada === 'LOCAL DE CRIME') return 'M110';
  if (normalizada === '94' || normalizada === 'NECROPSIA') return 'T002';
  return null;
}

export function sugerirRepColeta(origem: string, referencias?: RepsMesmoCasoGdl): string {
  const codigo = codigoColetaPorOrigem(origem);
  const compativeis = codigo ? referencias?.reps.filter(rep => rep.codigoNatureza === codigo) ?? [] : [];
  return compativeis.length === 1 ? formatarReferenciaColeta(compativeis[0]) : '';
}
