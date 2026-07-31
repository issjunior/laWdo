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

export type AcaoPainelIa = AcaoIa | 'descrever_imagem';

export interface MensagemPainelIa {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  aplicacao?: 'inserir' | 'substituir';
  acao?: AcaoPainelIa;
  permiteAplicacao?: boolean;
}

export interface EstadoPainelIa {
  revisao: number;
  titulo: string;
  carregando: boolean;
  erro: string | null;
  editorDisponivel: boolean;
  imagemSelecionada: boolean;
  contextoImagem: boolean;
  modoAplicacao: 'inserir' | 'substituir';
  mensagens: MensagemPainelIa[];
  escopos: Array<{ id: number; titulo: string }>;
}

export type ComandoPainelIa =
  | { tipo: 'executar_acao'; acao: AcaoIa }
  | { tipo: 'enviar_pedido_livre'; mensagem: string; aplicacao: 'inserir' | 'reescrever' }
  | { tipo: 'aplicar_resposta'; indiceMensagem: number }
  | { tipo: 'cancelar_operacao' }
  | { tipo: 'descrever_imagem' }
  | { tipo: 'selecionar_escopo'; indice: number };

export function comandoPainelIaValido(valor: unknown): valor is ComandoPainelIa {
  if (!valor || typeof valor !== 'object') return false;
  const comando = valor as Record<string, unknown>;
  if (comando.tipo === 'executar_acao') return typeof comando.acao === 'string' && ACOES_IA.includes(comando.acao as AcaoIa);
  if (comando.tipo === 'enviar_pedido_livre') {
    return typeof comando.mensagem === 'string'
      && comando.mensagem.trim().length > 0
      && (comando.aplicacao === 'inserir' || comando.aplicacao === 'reescrever');
  }
  if (comando.tipo === 'aplicar_resposta') return Number.isInteger(comando.indiceMensagem) && (comando.indiceMensagem as number) >= 0;
  if (comando.tipo === 'cancelar_operacao' || comando.tipo === 'descrever_imagem') return true;
  return comando.tipo === 'selecionar_escopo' && Number.isInteger(comando.indice);
}
