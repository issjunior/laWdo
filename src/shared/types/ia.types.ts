export const ACOES_IA = [
  'ortografia',
  'tecnico_pericial',
  'reescrever',
  'clareza',
  'resumir',
  'expandir',
  'inserir',
] as const;

export type AcaoIa = typeof ACOES_IA[number];
export type EscopoIa = 'selecao' | 'secao' | 'laudo_completo' | 'cursor';
export type TomRespostaIa = 'tecnico_pericial' | 'formal' | 'direto';
export type DetalhamentoRespostaIa = 'conciso' | 'equilibrado' | 'detalhado';

export interface PerfilRespostaIa {
  versao: 1;
  tom: TomRespostaIa;
  detalhamento: DetalhamentoRespostaIa;
  instrucoesPersonalizadas: string;
}

export const PERFIL_RESPOSTA_IA_PADRAO: PerfilRespostaIa = {
  versao: 1,
  tom: 'tecnico_pericial',
  detalhamento: 'equilibrado',
  instrucoesPersonalizadas: '',
};

export interface FragmentoIa {
  id: string;
  texto: string;
}

export interface SolicitacaoIa {
  operationId: string;
  acao: AcaoIa;
  escopo: EscopoIa;
  instrucao?: string;
  fragmentos: FragmentoIa[];
}

export interface ContextoIa {
  configurado: boolean;
  provedor?: 'groq' | 'gemini';
  modelo?: string;
  suportaVisao: boolean;
}

export interface ErroIa {
  codigo: 'CONFIGURACAO_AUSENTE' | 'ENTRADA_INVALIDA' | 'CANCELADO' | 'TIMEOUT' | 'PROVEDOR_INDISPONIVEL' | 'RESPOSTA_INVALIDA' | 'ERRO_INTERNO';
  mensagem: string;
  retryable: boolean;
  acaoSugerida: string;
}

export interface RespostaIa {
  operationId: string;
  fragmentos: FragmentoIa[];
}
