import { z } from 'zod';

export const INTERVALO_CONEXAO_GDL_MS = 60_000;
export const VALIDADE_CONEXAO_GDL_MS = 120_000;

export const esquemaEstadoConexaoGdl = z.object({
  ambiente: z.enum(['producao', 'homologacao']),
  revisao: z.number().int().nonnegative(),
  rede: z.enum(['desconhecida', 'acessivel', 'indisponivel']),
  redeVerificadaEm: z.string().datetime().nullable(),
  credenciais: z.enum(['ausentes', 'pendentes', 'validadas', 'rejeitadas']),
  credenciaisValidadasEm: z.string().datetime().nullable(),
  web: z.enum(['desconhecida', 'disponivel', 'atencao']),
  verificando: z.boolean(),
});

export type EstadoConexaoGdl = z.infer<typeof esquemaEstadoConexaoGdl>;
export type AparenciaConexaoGdl = 'desconhecida' | 'disponivel' | 'atencao' | 'indisponivel';

export function aparenciaConexaoGdl(estado: EstadoConexaoGdl | null, agora = Date.now()): AparenciaConexaoGdl {
  if (!estado?.redeVerificadaEm || agora - Date.parse(estado.redeVerificadaEm) > VALIDADE_CONEXAO_GDL_MS
    || estado.rede === 'desconhecida') return 'desconhecida';
  if (estado.rede === 'indisponivel') return 'indisponivel';
  return estado.credenciais === 'validadas' && estado.web !== 'atencao' ? 'disponivel' : 'atencao';
}
