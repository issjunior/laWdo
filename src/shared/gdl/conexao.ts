import { z } from 'zod';
import { MENSAGEM_ACESSO_REDE_GDL } from './acesso-institucional.js';

export const INTERVALO_CONEXAO_GDL_MS = 60_000;

const esquemaAcessoAutenticadoGdl = z.object({
  origem: z.enum(['api', 'web']),
  resultado: z.enum(['sucesso', 'rejeitada', 'falha']),
  realizadaEm: z.string().datetime(),
  confirmadoEm: z.string().datetime().nullable(),
  rejeicaoPendente: z.boolean(),
  motivo: z.string().optional(),
  condicaoEsperada: z.literal('acesso_rede_institucional').optional(),
});
export type AcessoAutenticadoGdl = z.infer<typeof esquemaAcessoAutenticadoGdl>;

export const esquemaEstadoConexaoGdl = z.object({
  ambiente: z.enum(['producao', 'homologacao']),
  revisao: z.number().int().nonnegative(),
  versaoEstado: z.number().int().nonnegative(),
  rede: z.enum(['desconhecida', 'acessivel', 'indisponivel']),
  redeVerificadaEm: z.string().datetime().nullable(),
  credenciais: z.enum(['ausentes', 'pendentes', 'validadas', 'rejeitadas']),
  credenciaisValidadasEm: z.string().datetime().nullable(),
  web: z.enum(['desconhecida', 'disponivel', 'atencao']),
  verificando: z.boolean(),
  ultimoTesteRede: z.object({
    sucesso: z.boolean(),
    verificadoEm: z.string().datetime(),
    duracaoMs: z.number().finite().nonnegative(),
  }).nullable().optional(),
  acessoAutenticado: esquemaAcessoAutenticadoGdl.nullable().optional(),
});

export type EstadoConexaoGdl = z.infer<typeof esquemaEstadoConexaoGdl>;
export type AparenciaConexaoGdl = 'desconhecida' | 'disponivel' | 'atencao' | 'indisponivel' | 'acessivel';

export function apresentarConexaoGdl(estado: EstadoConexaoGdl | null): {
  aparencia: AparenciaConexaoGdl; mensagem: string; orientacao: string | null; problemaCredenciais?: 'ausentes' | 'rejeitadas';
} {
  if (estado?.credenciais === 'ausentes') return {
    aparencia: 'atencao', mensagem: 'Configure seu acesso ao GDL', problemaCredenciais: 'ausentes',
    orientacao: 'Informe seu login, sua senha e seu CPF na página API GDL.',
  };
  const acesso = estado?.acessoAutenticado;
  const falhaDeRedeSuperada = acesso?.resultado === 'falha'
    && (acesso.motivo === 'rede' || acesso.motivo === 'tempo_esgotado')
    && estado?.rede === 'acessivel'
    && estado.redeVerificadaEm !== null
    && Date.parse(estado.redeVerificadaEm) > Date.parse(acesso.realizadaEm);
  if (acesso?.resultado === 'rejeitada' || acesso?.rejeicaoPendente || (!acesso && estado?.credenciais === 'rejeitadas')) return {
    aparencia: 'atencao', mensagem: 'Confira suas credenciais', problemaCredenciais: 'rejeitadas',
    orientacao: 'Confira seu login e sua senha na página API GDL e salve as configurações.',
  };
  if (acesso?.resultado === 'falha' && !falhaDeRedeSuperada) return {
    aparencia: acesso.motivo === 'rede' || acesso.motivo === 'tempo_esgotado' ? 'indisponivel' : 'atencao',
    mensagem: 'Não foi possível recuperar dados do GDL',
    orientacao: acesso.condicaoEsperada === 'acesso_rede_institucional' ? MENSAGEM_ACESSO_REDE_GDL
      : 'A última consulta ao GDL não foi concluída. Consulte os detalhes da operação e tente novamente.',
  };
  if (estado?.rede === 'indisponivel') return {
    aparencia: 'indisponivel', mensagem: 'Não foi possível conectar ao GDL', orientacao: MENSAGEM_ACESSO_REDE_GDL,
  };
  if (acesso?.resultado === 'sucesso' && acesso.confirmadoEm) return {
    aparencia: 'disponivel', mensagem: 'Acesso ao GDL confirmado', orientacao: null,
  };
  if (estado?.rede === 'acessivel') return {
    aparencia: 'acessivel', mensagem: 'Conexão disponível', orientacao: null,
  };
  return { aparencia: 'desconhecida', mensagem: 'Teste sua conexão com o GDL', orientacao: null };
}

export function aparenciaConexaoGdl(estado: EstadoConexaoGdl | null): AparenciaConexaoGdl {
  return apresentarConexaoGdl(estado).aparencia;
}
