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

export interface ConfiguracaoPrivacidadeIa {
  versao: 1;
  enviarConteudoIntegral: boolean;
}

export const CONFIGURACAO_PRIVACIDADE_IA_PADRAO: ConfiguracaoPrivacidadeIa = {
  versao: 1,
  enviarConteudoIntegral: true,
};

export function configuracaoPrivacidadeIaValida(valor: unknown): valor is ConfiguracaoPrivacidadeIa {
  if (!valor || typeof valor !== 'object') return false;
  const configuracao = valor as Record<string, unknown>;
  return configuracao.versao === 1
    && typeof configuracao.enviarConteudoIntegral === 'boolean';
}

export function deveMascararConteudoIa(configuracao: ConfiguracaoPrivacidadeIa): boolean {
  return !configuracao.enviarConteudoIntegral;
}

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

export interface SolicitacaoDescricaoImagemIa {
  operationId: string;
  laudoId: string;
  imagemId: string;
}

export interface ContextoIa {
  configurado: boolean;
  provedor?: 'groq' | 'gemini';
  modelo?: string;
  suportaVisao: boolean;
}

export interface ErroIa {
  codigo:
    | 'CONFIGURACAO_AUSENTE'
    | 'ENTRADA_INVALIDA'
    | 'MODELO_INCOMPATIVEL'
    | 'FORMATO_IMAGEM_NAO_SUPORTADO'
    | 'IMAGEM_MUITO_GRANDE'
    | 'IMAGEM_PROTEGIDA'
    | 'CANCELADO'
    | 'TIMEOUT'
    | 'SEM_CONEXAO'
    | 'PROVEDOR_INDISPONIVEL'
    | 'RESPOSTA_INVALIDA'
    | 'RESPOSTA_VAZIA'
    | 'ERRO_INTERNO';
  mensagem: string;
  retryable: boolean;
  acaoSugerida: string;
}

export interface RespostaIa {
  operationId: string;
  fragmentos: FragmentoIa[];
}

export interface RespostaDescricaoImagemIa {
  operationId: string;
  descricao: string;
}
