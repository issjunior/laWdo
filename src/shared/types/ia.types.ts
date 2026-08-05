export const ACOES_IA = [
  'ortografia',
  'tecnico_pericial',
  'reescrever',
  'clareza',
  'resumir',
  'expandir',
  'inserir',
] as const;

export const ESCOPOS_IA = ['selecao', 'secao', 'laudo_completo', 'cursor'] as const;

export type AcaoIa = typeof ACOES_IA[number];
export type EscopoIa = typeof ESCOPOS_IA[number];
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

export function perfilRespostaIaValido(valor: unknown): valor is PerfilRespostaIa {
  if (!valor || typeof valor !== 'object') return false;
  const perfil = valor as Record<string, unknown>;
  return perfil.versao === 1
    && ['tecnico_pericial', 'formal', 'direto'].includes(String(perfil.tom))
    && ['conciso', 'equilibrado', 'detalhado'].includes(String(perfil.detalhamento))
    && typeof perfil.instrucoesPersonalizadas === 'string'
    && perfil.instrucoesPersonalizadas.length <= 2_000;
}

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
  contextoResolvido?: string;
  planoId?: string;
  retomadaId?: string;
  fragmentos: FragmentoIa[];
}

export function solicitacaoIaValida(valor: unknown): valor is SolicitacaoIa {
  if (!valor || typeof valor !== 'object') return false;
  const solicitacao = valor as Record<string, unknown>;
  if (
    typeof solicitacao.operationId !== 'string'
    || !solicitacao.operationId.trim()
    || typeof solicitacao.acao !== 'string'
    || !ACOES_IA.includes(solicitacao.acao as AcaoIa)
    || typeof solicitacao.escopo !== 'string'
    || !ESCOPOS_IA.includes(solicitacao.escopo as EscopoIa)
    || (solicitacao.instrucao !== undefined && (typeof solicitacao.instrucao !== 'string' || solicitacao.instrucao.length > 10_000))
    || (solicitacao.contextoResolvido !== undefined && (typeof solicitacao.contextoResolvido !== 'string' || solicitacao.contextoResolvido.length > 200_000))
    || (solicitacao.planoId !== undefined && (typeof solicitacao.planoId !== 'string' || !solicitacao.planoId))
    || (solicitacao.retomadaId !== undefined && (typeof solicitacao.retomadaId !== 'string' || !solicitacao.retomadaId))
    || !Array.isArray(solicitacao.fragmentos)
    || solicitacao.fragmentos.length === 0
  ) return false;

  const ids = new Set<string>();
  return solicitacao.fragmentos.every(fragmento => {
    if (!fragmento || typeof fragmento !== 'object') return false;
    const item = fragmento as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.texto !== 'string' || !item.texto) return false;
    ids.add(item.id);
    return true;
  });
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
    | 'NAO_AUTORIZADO'
    | 'ENTRADA_INVALIDA'
    | 'LIMITE_EXCEDIDO'
    | 'LIMITE_REQUISICOES'
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
    | 'CONFIRMACAO_NECESSARIA'
    | 'PLANO_ALTERADO'
    | 'RETOMADA_INDISPONIVEL'
    | 'RETOMADA_INVALIDA'
    | 'OPERACAO_EM_ANDAMENTO'
    | 'ERRO_INTERNO';
  mensagem: string;
  retryable: boolean;
  acaoSugerida: string;
}

export interface RespostaIa {
  operationId: string;
  fragmentos: FragmentoIa[];
}

export interface PlanoExecucaoIaResumo {
  planoId: string;
  acao: AcaoIa;
  escopo: EscopoIa;
  provedor: 'groq' | 'gemini';
  modelo: string;
  totalLotes: number;
  chamadasBase: number;
  limiteMaximoChamadas: number;
  requerConfirmacao: boolean;
}

export function planoExecucaoIaResumoValido(valor: unknown): valor is PlanoExecucaoIaResumo {
  if (!valor || typeof valor !== 'object') return false;
  const plano = valor as Record<string, unknown>;
  return typeof plano.planoId === 'string'
    && Boolean(plano.planoId)
    && typeof plano.acao === 'string'
    && ACOES_IA.includes(plano.acao as AcaoIa)
    && typeof plano.escopo === 'string'
    && ESCOPOS_IA.includes(plano.escopo as EscopoIa)
    && (plano.provedor === 'groq' || plano.provedor === 'gemini')
    && typeof plano.modelo === 'string'
    && Boolean(plano.modelo)
    && Number.isInteger(plano.totalLotes)
    && (plano.totalLotes as number) > 0
    && plano.chamadasBase === plano.totalLotes
    && Number.isInteger(plano.limiteMaximoChamadas)
    && (plano.limiteMaximoChamadas as number) >= (plano.chamadasBase as number)
    && typeof plano.requerConfirmacao === 'boolean';
}

export interface RetomadaIa {
  retomadaId: string;
  planoId: string;
  lotesConcluidos: number;
  totalLotes: number;
}

export function retomadaIaValida(valor: unknown): valor is RetomadaIa {
  if (!valor || typeof valor !== 'object') return false;
  const retomada = valor as Record<string, unknown>;
  return typeof retomada.retomadaId === 'string'
    && Boolean(retomada.retomadaId)
    && typeof retomada.planoId === 'string'
    && Boolean(retomada.planoId)
    && Number.isInteger(retomada.lotesConcluidos)
    && (retomada.lotesConcluidos as number) > 0
    && Number.isInteger(retomada.totalLotes)
    && (retomada.totalLotes as number) > (retomada.lotesConcluidos as number);
}

export interface RespostaExecucaoIaIpc {
  success: boolean;
  data?: RespostaIa;
  error?: string;
  retomada?: RetomadaIa;
}

export type FaseProgressoIa = 'preparando' | 'processando' | 'concluido';

export interface ProgressoIa {
  operationId: string;
  fase: FaseProgressoIa;
  loteAtual: number;
  totalLotes: number;
  tentativa: number;
  chamadasConcluidas: number;
}

export function progressoIaValido(valor: unknown): valor is ProgressoIa {
  if (!valor || typeof valor !== 'object') return false;
  const progresso = valor as Record<string, unknown>;
  return typeof progresso.operationId === 'string'
    && Boolean(progresso.operationId)
    && (progresso.fase === 'preparando' || progresso.fase === 'processando' || progresso.fase === 'concluido')
    && Number.isInteger(progresso.loteAtual)
    && (progresso.loteAtual as number) >= 0
    && Number.isInteger(progresso.totalLotes)
    && (progresso.totalLotes as number) > 0
    && (progresso.loteAtual as number) <= (progresso.totalLotes as number)
    && Number.isInteger(progresso.tentativa)
    && (progresso.tentativa as number) >= 0
    && Number.isInteger(progresso.chamadasConcluidas)
    && (progresso.chamadasConcluidas as number) >= 0
    && (progresso.chamadasConcluidas as number) <= (progresso.totalLotes as number);
}

export interface RespostaDescricaoImagemIa {
  operationId: string;
  descricao: string;
}

export type AcaoPainelIa = AcaoIa | 'descrever_imagem';

export interface MensagemPainelIa {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  aplicacao?: 'inserir' | 'substituir';
  acao?: AcaoPainelIa;
  permiteAplicacao?: boolean;
  proposalId?: string;
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
  progresso: ProgressoIa | null;
  planoPendente: PlanoExecucaoIaResumo | null;
  retomada: RetomadaIa | null;
  mensagens: MensagemPainelIa[];
  escopos: Array<{ id: number; titulo: string }>;
}

export type CamposEstadoPainelIa = Omit<EstadoPainelIa, 'revisao'>;

export interface SnapshotPainelIa {
  tipo: 'snapshot';
  estado: EstadoPainelIa;
}

export interface DeltaPainelIa {
  tipo: 'delta';
  revisao: number;
  alteracoes: Partial<CamposEstadoPainelIa>;
}

export type AtualizacaoPainelIa = SnapshotPainelIa | DeltaPainelIa;

const CAMPOS_ESTADO_PAINEL_IA: Array<keyof CamposEstadoPainelIa> = [
  'titulo',
  'carregando',
  'erro',
  'editorDisponivel',
  'imagemSelecionada',
  'contextoImagem',
  'modoAplicacao',
  'progresso',
  'planoPendente',
  'retomada',
  'mensagens',
  'escopos',
];

function mensagensPainelIaValidas(valor: unknown): valor is MensagemPainelIa[] {
  return Array.isArray(valor) && valor.every(mensagem => {
    if (!mensagem || typeof mensagem !== 'object') return false;
    const item = mensagem as Record<string, unknown>;
    return typeof item.id === 'string'
      && Boolean(item.id)
      && (item.role === 'user' || item.role === 'assistant')
      && typeof item.content === 'string'
      && typeof item.timestamp === 'number';
  });
}

function escoposPainelIaValidos(valor: unknown): valor is EstadoPainelIa['escopos'] {
  return Array.isArray(valor) && valor.every(escopo => {
    if (!escopo || typeof escopo !== 'object') return false;
    const item = escopo as Record<string, unknown>;
    return Number.isInteger(item.id) && typeof item.titulo === 'string';
  });
}

function campoEstadoPainelIaValido(campo: keyof CamposEstadoPainelIa, valor: unknown): boolean {
  switch (campo) {
    case 'titulo': return typeof valor === 'string';
    case 'carregando':
    case 'editorDisponivel':
    case 'imagemSelecionada':
    case 'contextoImagem': return typeof valor === 'boolean';
    case 'erro': return valor === null || typeof valor === 'string';
    case 'modoAplicacao': return valor === 'inserir' || valor === 'substituir';
    case 'progresso': return valor === null || progressoIaValido(valor);
    case 'planoPendente': return valor === null || planoExecucaoIaResumoValido(valor);
    case 'retomada': return valor === null || retomadaIaValida(valor);
    case 'mensagens': return mensagensPainelIaValidas(valor);
    case 'escopos': return escoposPainelIaValidos(valor);
  }
}

export function estadoPainelIaValido(valor: unknown): valor is EstadoPainelIa {
  if (!valor || typeof valor !== 'object') return false;
  const estado = valor as Record<string, unknown>;
  return Number.isInteger(estado.revisao)
    && (estado.revisao as number) > 0
    && CAMPOS_ESTADO_PAINEL_IA.every(campo => campoEstadoPainelIaValido(campo, estado[campo]));
}

export function atualizacaoPainelIaValida(valor: unknown): valor is AtualizacaoPainelIa {
  if (!valor || typeof valor !== 'object') return false;
  const atualizacao = valor as Record<string, unknown>;
  if (atualizacao.tipo === 'snapshot') return estadoPainelIaValido(atualizacao.estado);
  if (atualizacao.tipo !== 'delta'
    || !Number.isInteger(atualizacao.revisao)
    || (atualizacao.revisao as number) <= 0
    || !atualizacao.alteracoes
    || typeof atualizacao.alteracoes !== 'object') return false;

  const alteracoes = atualizacao.alteracoes as Record<string, unknown>;
  const campos = Object.keys(alteracoes);
  return campos.length > 0
    && campos.every(campo => CAMPOS_ESTADO_PAINEL_IA.includes(campo as keyof CamposEstadoPainelIa)
      && campoEstadoPainelIaValido(campo as keyof CamposEstadoPainelIa, alteracoes[campo]));
}

export function aplicarAtualizacaoPainelIa(
  estadoAtual: EstadoPainelIa | null,
  atualizacao: AtualizacaoPainelIa,
): { estado: EstadoPainelIa | null; requerRessincronizacao: boolean } {
  if (atualizacao.tipo === 'snapshot') {
    return {
      estado: !estadoAtual || atualizacao.estado.revisao > estadoAtual.revisao
        ? atualizacao.estado
        : estadoAtual,
      requerRessincronizacao: false,
    };
  }
  if (!estadoAtual) return { estado: null, requerRessincronizacao: true };
  if (atualizacao.revisao <= estadoAtual.revisao) {
    return { estado: estadoAtual, requerRessincronizacao: false };
  }
  if (atualizacao.revisao !== estadoAtual.revisao + 1) {
    return { estado: estadoAtual, requerRessincronizacao: true };
  }
  return {
    estado: { ...estadoAtual, ...atualizacao.alteracoes, revisao: atualizacao.revisao },
    requerRessincronizacao: false,
  };
}

export type ComandoPainelIa =
  | { tipo: 'executar_acao'; acao: AcaoIa }
  | { tipo: 'enviar_pedido_livre'; mensagem: string; aplicacao: 'inserir' | 'reescrever' }
  | { tipo: 'aplicar_resposta'; mensagemId: string }
  | { tipo: 'cancelar_operacao' }
  | { tipo: 'retomar_operacao' }
  | { tipo: 'confirmar_execucao' }
  | { tipo: 'cancelar_confirmacao' }
  | { tipo: 'descrever_imagem' }
  | { tipo: 'solicitar_ressincronizacao' }
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
  if (comando.tipo === 'aplicar_resposta') return typeof comando.mensagemId === 'string' && Boolean(comando.mensagemId);
  if (comando.tipo === 'cancelar_operacao'
    || comando.tipo === 'retomar_operacao'
    || comando.tipo === 'confirmar_execucao'
    || comando.tipo === 'cancelar_confirmacao'
    || comando.tipo === 'descrever_imagem'
    || comando.tipo === 'solicitar_ressincronizacao') return true;
  return comando.tipo === 'selecionar_escopo' && Number.isInteger(comando.indice);
}
